const router = require("express").Router();
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const { authenticate, requireRole, requireSendPermission } = require("../middlewares/auth.middleware");
// Trả JSON PHẲNG để khớp frontend port từ QUESON (không bọc {success,message,data})
const ok = (res, data) => res.json(data || { ok: true });
const fail = (res, msg, code = 400) => res.status(code).json({ error: msg });
const ZaloFollowerRepo = require("../repositories/mongo/ZaloFollowerRepo");
const ZaloService = require("../services/ZaloService");
const ZaloGroup = require("../models/mongo/ZaloGroup");
const ZaloGroupMember = require("../models/mongo/ZaloGroupMember");
const zaloGmf = require("../utils/zaloGmf");
const BroadcastLog = require("../models/mongo/BroadcastLog");
const ScheduledBroadcast = require("../models/mongo/ScheduledBroadcast");
const { sendToUsers, getJob } = require("../services/broadcastService");
const { sendBroadcastPost, getJob: getPostJob } = require("../services/broadcastPostService");
const Broadcast = require("../models/mongo/Broadcast");
const { uploadImageToZalo, uploadFileToZalo, getArticleSlice, getArticleDetail, createArticle, removeArticle } = require("../utils/zaloBroadcast");
const { uploadFromBuffer } = require("../utils/cloudinaryUpload");
const env = require("../config/env");
const { prisma } = require("../config/database");

const UPLOAD_DIR = path.join(__dirname, "../../uploads");
const PUBLIC_BASE = (env.CORS_ORIGINS || []).join(",").includes("dxvtech") ? "https://api.dxvtech.vn" : "https://api.dxvtech.vn";

// Mọi endpoint cần đăng nhập + vai trò quản trị
router.use(authenticate, requireRole("SUPER_ADMIN", "ADMIN_VILLAGE"));

// ── Followers (tái dùng hệ follower sẵn có của HOATIEN) ─────────────
router.get("/followers", async (req, res, next) => {
  try {
    const list = await ZaloFollowerRepo.findAll();
    // Lấy tất cả members đã liên kết Zalo để join tên vào response
    const linkedMembers = await prisma.member.findMany({
      where: { zaloUserId: { not: null } },
      select: { id: true, hoTen: true, sdt: true, zaloUserId: true, household: { select: { soHoKhau: true, village: { select: { ten: true } } } } },
    });
    const memberByZaloId = Object.fromEntries(linkedMembers.map((m) => [m.zaloUserId, m]));
    const followers = list.map((f) => ({
      user_id: f.userId,
      display_name: f.displayName || "",
      avatar: f.avatar || "",
      phone: f.phone || "",
      linkedMemberId: f.linkedMemberId || null,
      linkedMember: memberByZaloId[f.userId] || null,
    }));
    ok(res, { followers, count: followers.length, syncing: ZaloService.isSyncing(), syncedAt: null });
  } catch (err) { next(err); }
});

// Nội dung tin đề nghị dân nhắn SĐT (dân trả lời số là webhook tự khớp + liên kết)
const REQUEST_PHONE_MSG =
  "📱 UBND Xã Hòa Tiến kính đề nghị bà con nhắn SỐ ĐIỆN THOẠI của mình (VD: 0905123456) để liên kết với hồ sơ nhân khẩu.\n\nSố điện thoại chỉ dùng cho công tác quản lý dân cư và gửi thông báo của xã.";

// Gửi tin xin SĐT tới 1 follower (không dùng form request_user_info vì OAuth hay lỗi -14003)
router.post("/followers/:userId/request-info", requireSendPermission(), async (req, res, next) => {
  try {
    const { sendText } = require("../utils/zaloBroadcast");
    await sendText(req.params.userId, REQUEST_PHONE_MSG);
    ok(res, { ok: true });
  } catch (err) { next(err); }
});

// Quét lịch sử hội thoại của follower chưa liên kết tìm SĐT dân từng nhắn → tự liên kết (chạy nền)
router.post("/followers/scan-conversations", async (req, res, next) => {
  try {
    const r = ZaloService.startScanConversations();
    ok(res, { ...r, ...ZaloService.getScanState() });
  } catch (err) { next(err); }
});

router.get("/followers/scan-conversations/status", async (req, res, next) => {
  try { ok(res, ZaloService.getScanState()); } catch (err) { next(err); }
});

// Gửi tin xin SĐT hàng loạt (chỉ tới các userIds truyền lên — thường là follower chưa liên kết)
router.post("/followers/request-info-bulk", requireSendPermission(), async (req, res, next) => {
  try {
    const { userIds = [] } = req.body;
    if (!Array.isArray(userIds) || userIds.length === 0) return fail(res, "Cần danh sách userIds");
    const { sendText } = require("../utils/zaloBroadcast");
    let sent = 0;
    const failed = [];
    for (const uid of userIds) {
      try { await sendText(String(uid), REQUEST_PHONE_MSG); sent++; }
      catch (e) { failed.push({ userId: String(uid), error: e.message }); }
    }
    ok(res, { sent, failed: failed.length, total: userIds.length });
  } catch (err) { next(err); }
});

// Liên kết thủ công follower Zalo ↔ nhân khẩu
router.post("/followers/:userId/link", async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { memberId } = req.body;
    if (!memberId) return fail(res, "Thiếu memberId");

    const member = await prisma.member.findUnique({ where: { id: memberId }, select: { id: true, hoTen: true, zaloUserId: true } });
    if (!member) return fail(res, "Không tìm thấy nhân khẩu", 404);
    if (member.zaloUserId && member.zaloUserId !== userId)
      return fail(res, `Nhân khẩu này đã liên kết Zalo khác (${member.zaloUserId})`);

    // Nếu follower đang link sang member cũ → gỡ member cũ trước
    const oldFollower = await ZaloFollowerRepo.findByUserId(userId);
    if (oldFollower?.linkedMemberId && oldFollower.linkedMemberId !== memberId) {
      await prisma.member.updateMany({ where: { id: oldFollower.linkedMemberId }, data: { zaloUserId: null } });
    }

    await Promise.all([
      ZaloFollowerRepo.setLink(userId, memberId),
      prisma.member.update({ where: { id: memberId }, data: { zaloUserId: userId } }),
    ]);
    ok(res, { ok: true, userId, memberId, hoTen: member.hoTen });
  } catch (err) { next(err); }
});

// Hủy liên kết follower Zalo ↔ nhân khẩu
router.delete("/followers/:userId/link", async (req, res, next) => {
  try {
    const { userId } = req.params;
    const follower = await ZaloFollowerRepo.findByUserId(userId);
    const oldMemberId = follower?.linkedMemberId;
    await ZaloFollowerRepo.setLink(userId, null);
    if (oldMemberId) {
      await prisma.member.updateMany({ where: { id: oldMemberId }, data: { zaloUserId: null } });
    }
    ok(res, { ok: true });
  } catch (err) { next(err); }
});

// Khởi động job liên kết tự động (chạy nền, trả jobId ngay)
router.post("/auto-link-by-phone", async (req, res, next) => {
  try {
    const { villageId } = req.body;
    if (!villageId) return fail(res, "Thiếu villageId");
    if (req.user.role === "ADMIN_VILLAGE" && req.user.villageIds?.length && !req.user.villageIds.includes(villageId))
      return fail(res, "Không có quyền trên thôn này", 403);
    const jobId = ZaloService.startAutoLink(villageId);
    ok(res, { jobId, status: "started" });
  } catch (err) { next(err); }
});

// Poll tiến độ job liên kết tự động
router.get("/auto-link-status/:jobId", async (req, res, next) => {
  try {
    const job = ZaloService.getAutoLinkJob(req.params.jobId);
    if (!job) return fail(res, "Không tìm thấy job", 404);
    ok(res, job);
  } catch (err) { next(err); }
});

// Follower đã theo dõi OA và thuộc 1 thôn cụ thể (khớp qua Member.zaloUserId)
router.get("/followers/by-village/:villageId", async (req, res, next) => {
  try {
    const { villageId } = req.params;
    if (req.user.role === "ADMIN_VILLAGE" && req.user.villageIds?.length && !req.user.villageIds.includes(villageId)) {
      return fail(res, "Không có quyền trên thôn này", 403);
    }
    const [totalMembers, membersWithZalo] = await Promise.all([
      prisma.member.count({ where: { trangThai: "ACTIVE", household: { villageId } } }),
      prisma.member.findMany({
        where: { trangThai: "ACTIVE", zaloUserId: { not: null }, household: { villageId } },
        select: { zaloUserId: true },
      }),
    ]);
    const zaloIds = new Set(membersWithZalo.map((m) => m.zaloUserId));
    if (zaloIds.size === 0) {
      return ok(res, { followers: [], totalMembers, matchedCount: 0 });
    }
    const list = await ZaloFollowerRepo.findAll();
    const followers = list
      .filter((f) => zaloIds.has(f.userId))
      .map((f) => ({ user_id: f.userId, display_name: f.displayName || "", avatar: f.avatar || "", linkedMemberId: f.linkedMemberId || null }));
    ok(res, { followers, totalMembers, matchedCount: followers.length });
  } catch (err) { next(err); }
});

router.post("/followers/sync", async (req, res, next) => {
  try {
    const r = ZaloService.startSyncFollowers();
    const list = await ZaloFollowerRepo.findAll();
    ok(res, { ok: true, ...r, count: list.length }, r.running ? "Đang đồng bộ..." : "Đã bắt đầu đồng bộ (tên cập nhật dần)");
  } catch (err) { next(err); }
});

// ── Groups (nhóm Zalo) ─────────────────────────────────────────────
async function listGroups() {
  const docs = await ZaloGroup.find().sort({ name: 1 }).lean();
  const counts = await ZaloGroupMember.aggregate([{ $group: { _id: "$groupId", n: { $sum: 1 } } }]);
  const cmap = Object.fromEntries(counts.map((c) => [c._id, c.n]));
  return docs.map((g) => ({ id: String(g._id), group_id: g.groupId, name: g.name, icon: g.icon || "📋", memberCount: cmap[g.groupId] || 0, autoApprove: g.autoApprove || false }));
}

// Zalo có thể trả về string id hoặc object cho 1 người đang chờ duyệt — chuẩn hóa lại
function normalizePendingMember(m) {
  if (typeof m === "string") return { id: m, name: "", avatar: "" };
  return {
    id: String(m.id || m.user_id || m.uid || ""),
    name: m.name || m.display_name || m.user_name || "",
    avatar: m.avatar || m.avatar_url || "",
  };
}

router.get("/groups", async (req, res, next) => {
  try { ok(res, { groups: await listGroups() }); } catch (err) { next(err); }
});

// Liên kết nhóm có sẵn bằng group_id
router.post("/groups", async (req, res, next) => {
  try {
    const { group_id, name, icon } = req.body;
    if (!group_id || !group_id.trim()) return fail(res, "Cần group_id");
    await ZaloGroup.findOneAndUpdate(
      { groupId: group_id.trim() },
      { $set: { name: (name || "").trim() || group_id.trim(), ...(icon && { icon }) } },
      { upsert: true }
    );
    ok(res, { ok: true, groups: await listGroups() });
  } catch (err) { next(err); }
});

// Sửa nhóm (đổi group_id/tên) — dùng bởi tab Followers&Nhóm
router.put("/groups/:id", async (req, res, next) => {
  try {
    const { group_id, name } = req.body;
    if (!group_id || !group_id.trim()) return fail(res, "Cần group_id mới");
    await ZaloGroup.deleteOne({ groupId: req.params.id });
    await ZaloGroup.findOneAndUpdate(
      { groupId: group_id.trim() },
      { $set: { name: (name || "").trim() || group_id.trim() } },
      { upsert: true }
    );
    ok(res, { ok: true, groups: await listGroups() });
  } catch (err) { next(err); }
});

// Tạo nhóm Zalo MỚI từ follower (GMF — cần OA có quyền Group Messaging)
router.post("/groups/create-zalo", requireSendPermission(), async (req, res, next) => {
  try {
    const { name, icon, members = [] } = req.body;
    if (!name || !name.trim()) return fail(res, "Cần tên nhóm");
    if (!Array.isArray(members) || members.length === 0) return fail(res, "Cần ít nhất 1 thành viên ban đầu (chuẩn Zalo)");
    const memberIds = members.map((m) => m.userId || m.zaloUserId).filter(Boolean);
    // Tạo nhóm với 50 người đầu (giới hạn body 3000 ký tự của Zalo)
    const groupId = await zaloGmf.createZaloGroup(name.trim(), memberIds, name.trim());
    if (!groupId) return fail(res, "Zalo không trả về group_id", 500);
    // Add thêm phần còn lại (nếu có) sau khi nhóm đã tạo thành công
    if (memberIds.length > 50) {
      await zaloGmf.addMembersToGroup(groupId, memberIds.slice(50)).catch(() => {});
    }
    await ZaloGroup.findOneAndUpdate(
      { groupId: String(groupId) },
      { $set: { name: name.trim(), icon: icon || "📋" } },
      { upsert: true }
    );
    for (const m of members) {
      const uid = m.userId || m.zaloUserId;
      if (!uid) continue;
      await ZaloGroupMember.findOneAndUpdate(
        { groupId: String(groupId), zaloUserId: String(uid) },
        { $set: { displayName: m.displayName || "", avatar: m.avatar || "" } },
        { upsert: true }
      ).catch(() => {});
    }
    ok(res, { ok: true, group_id: groupId, groups: await listGroups() });
  } catch (err) { next(err); }
});

// Tạo nhóm Zalo với TOÀN BỘ follower OA (background job, tránh timeout)
router.post("/groups/create-zalo-all-followers", requireSendPermission(), async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) return fail(res, "Cần tên nhóm");
    const jobId = ZaloService.startCreateGroupAllFollowers(name.trim());
    ok(res, { jobId, status: "started" });
  } catch (err) { next(err); }
});

router.get("/groups/create-zalo-all-followers-status/:jobId", async (req, res, next) => {
  try {
    const job = ZaloService.getCreateGroupAllFollowersJob(req.params.jobId);
    if (!job) return fail(res, "Không tìm thấy job", 404);
    ok(res, job);
  } catch (err) { next(err); }
});

// Xoá nhóm khỏi hệ thống (KHÔNG giải tán nhóm Zalo thật) + xoá thành viên
router.delete("/groups/:id", async (req, res, next) => {
  try {
    const id = req.params.id;
    const isOid = /^[0-9a-fA-F]{24}$/.test(id);
    const g = await ZaloGroup.findOne(isOid ? { _id: id } : { groupId: id });
    const gid = g ? g.groupId : id;
    await ZaloGroup.deleteOne({ groupId: gid });
    await ZaloGroupMember.deleteMany({ groupId: gid });
    ok(res, { ok: true, groups: await listGroups() });
  } catch (err) { next(err); }
});

// ── Thành viên trong nhóm ──────────────────────────────────────────
router.get("/groups/:groupId/members", async (req, res, next) => {
  try {
    const members = await ZaloGroupMember.find({ groupId: req.params.groupId }).lean();
    res.json({ members: members.map((m) => ({ id: String(m._id), zaloUserId: m.zaloUserId, displayName: m.displayName, avatar: m.avatar })) });
  } catch (err) { next(err); }
});

router.post("/groups/:groupId/members", async (req, res, next) => {
  try {
    const { zaloUserId, displayName, avatar } = req.body;
    if (!zaloUserId) return fail(res, "Cần zaloUserId");
    await ZaloGroupMember.findOneAndUpdate(
      { groupId: req.params.groupId, zaloUserId: String(zaloUserId) },
      { $set: { displayName: displayName || "", avatar: avatar || "" } },
      { upsert: true }
    );
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.delete("/groups/members/:memberId", async (req, res, next) => {
  try { await ZaloGroupMember.findByIdAndDelete(req.params.memberId); res.json({ ok: true }); } catch (err) { next(err); }
});

// Đồng bộ thành viên từ Zalo (GMF listmember) -> ghi đè
router.post("/groups/:groupId/members/sync", async (req, res, next) => {
  try {
    const { members } = await zaloGmf.getGroupMembersV3(req.params.groupId);
    await ZaloGroupMember.deleteMany({ groupId: req.params.groupId });
    // GMF listmember thường chỉ trả user_id (không kèm tên) → ghép tên từ danh bạ follower đã đồng bộ
    const followers = await ZaloFollowerRepo.findAll();
    const byId = Object.fromEntries(followers.map((f) => [f.userId, f]));
    let synced = 0;
    for (const m of members) {
      const uid = String(typeof m === "string" ? m : (m.user_id || m.member_id || m.id || ""));
      if (!uid) continue;
      const f = byId[uid] || {};
      const displayName = m.display_name || m.name || f.displayName || "";
      const avatar = m.avatar || f.avatar || "";
      await ZaloGroupMember.create({ groupId: req.params.groupId, zaloUserId: uid, displayName, avatar }).catch(() => {});
      synced++;
    }
    res.json({ ok: true, synced });
  } catch (err) { next(err); }
});

// ── Duyệt thành viên chờ vào nhóm (GMF pending invite) ─────────────
// Danh sách người đang chờ duyệt vào nhóm
router.get("/groups/:groupId/pending", async (req, res, next) => {
  try {
    const { members, total } = await zaloGmf.getPendingGroupMembers(req.params.groupId);
    res.json({ total, members: members.map(normalizePendingMember) });
  } catch (err) { next(err); }
});

// Duyệt: chấp nhận vào nhóm + lưu vào danh sách thành viên
router.post("/groups/:groupId/pending/approve", async (req, res, next) => {
  try {
    const { users = [] } = req.body; // [{ id, name, avatar }]
    if (!Array.isArray(users) || users.length === 0) return fail(res, "Cần chọn ít nhất 1 người để duyệt");
    const groupId = req.params.groupId;
    await zaloGmf.acceptGroupJoinRequest(groupId, users.map((u) => u.id));
    for (const u of users) {
      await ZaloGroupMember.findOneAndUpdate(
        { groupId, zaloUserId: String(u.id) },
        { $set: { displayName: u.name || "Người dùng Zalo", avatar: u.avatar || "" } },
        { upsert: true }
      ).catch(() => {});
    }
    res.json({ ok: true, approved: users.length });
  } catch (err) { next(err); }
});

// Từ chối: không cho vào nhóm
router.post("/groups/:groupId/pending/reject", async (req, res, next) => {
  try {
    const { userIds = [] } = req.body; // [id, ...]
    if (!Array.isArray(userIds) || userIds.length === 0) return fail(res, "Cần chọn ít nhất 1 người để từ chối");
    await zaloGmf.rejectGroupJoinRequest(req.params.groupId, userIds);
    res.json({ ok: true, rejected: userIds.length });
  } catch (err) { next(err); }
});

// Bật/tắt tự động duyệt thành viên xin vào nhóm này
router.patch("/groups/:groupId/auto-approve", async (req, res, next) => {
  try {
    const { autoApprove } = req.body;
    await ZaloGroup.findOneAndUpdate({ groupId: req.params.groupId }, { $set: { autoApprove: !!autoApprove } });
    ok(res, { ok: true, groups: await listGroups() });
  } catch (err) { next(err); }
});
// ── Upload ảnh -> Zalo attachment_id ───────────────────────────────
function makeUpload(filenamePrefix, opts) {
  const storage = multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (_, file, cb) => cb(null, `${filenamePrefix}_${Date.now()}_${Math.round(Math.random() * 1e4)}${path.extname(file.originalname).toLowerCase()}`),
  });
  return multer({ storage, ...opts });
}

router.post("/upload/image", (req, res) => {
  const upload = makeUpload("img", {
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_, file, cb) => (file.mimetype.startsWith("image/") ? cb(null, true) : cb(new Error("Chỉ nhận file ảnh"))),
  }).array("images", 5);
  upload(req, res, async (err) => {
    if (err) return res.status(400).json({ success: false, error: err.message });
    if (!req.files?.length) return res.status(400).json({ success: false, error: "Không có file" });
    try {
      const attachmentIds = await Promise.all(req.files.map(async (file) => {
        const id = await uploadImageToZalo(file.path);
        fs.unlink(file.path, () => {});
        return id;
      }));
      res.json({ ok: true, success: true, attachmentIds });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  });
});

router.post("/upload/video", (req, res) => {
  const upload = makeUpload("vid", { limits: { fileSize: 100 * 1024 * 1024 } }).single("video");
  upload(req, res, (err) => {
    if (err) return res.status(400).json({ success: false, error: err.message });
    if (!req.file) return res.status(400).json({ success: false, error: "Không có file video" });
    const videoUrl = `${PUBLIC_BASE}/uploads/${req.file.filename}`;
    setTimeout(() => fs.unlink(req.file.path, () => {}), 6 * 60 * 60 * 1000);
    res.json({ ok: true, success: true, articleToken: videoUrl });
  });
});

router.post("/upload/file", (req, res) => {
  const ALLOWED = [".docx", ".pdf", ".xlsx", ".xls"];
  const upload = makeUpload("file", {
    limits: { fileSize: 20 * 1024 * 1024 },
    fileFilter: (_, file, cb) => (ALLOWED.includes(path.extname(file.originalname).toLowerCase()) ? cb(null, true) : cb(new Error("Chỉ nhận .docx .pdf .xlsx .xls"))),
  }).single("file");
  upload(req, res, async (err) => {
    if (err) return res.status(400).json({ success: false, error: err.message });
    if (!req.file) return res.status(400).json({ success: false, error: "Không có file" });
    try {
      const attachmentId = await uploadFileToZalo(req.file.path, req.file.originalname);
      fs.unlink(req.file.path, () => {});
      res.json({ ok: true, success: true, attachmentId, filename: req.file.originalname });
    } catch (e) {
      fs.unlink(req.file.path, () => {});
      res.status(500).json({ success: false, error: e.message });
    }
  });
});

// ── Gửi (job async) ────────────────────────────────────────────────
router.post("/send", requireSendPermission(), async (req, res, next) => {
  try {
    const { userIds, message, attachmentIds, videoAttachmentId, fileAttachmentId, adminNote, linkUrl, linkTitle } = req.body;
    if (!userIds?.length) return fail(res, "Cần danh sách userIds");
    const hasContent = message || attachmentIds?.length || videoAttachmentId || fileAttachmentId || linkUrl;
    if (!hasContent) return fail(res, "Cần nội dung, ảnh, video, file hoặc link");
    const jobId = await sendToUsers(userIds, message, {
      attachmentIds: attachmentIds || [],
      videoAttachmentId: videoAttachmentId || null,
      fileAttachmentId: fileAttachmentId || null,
    }, adminNote, linkUrl, linkTitle);
    res.json({ ok: true, success: true, jobId, total: userIds.length });
  } catch (err) { next(err); }
});

router.get("/status/:jobId", (req, res) => {
  const job = getJob(req.params.jobId);
  if (!job) return res.status(404).json({ success: false, error: "Không tìm thấy job" });
  res.json(job);
});

// ── Lịch sử gửi ────────────────────────────────────────────────────
router.get("/logs", async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const logs = await BroadcastLog.find().sort({ timestamp: -1 }).limit(limit).lean();
    res.json({ logs: logs.map((l) => ({ id: l._id, ...l })) });
  } catch (err) { next(err); }
});

router.delete("/logs/all", async (req, res, next) => {
  try { await BroadcastLog.deleteMany({}); res.json({ ok: true, success: true }); } catch (err) { next(err); }
});

router.delete("/logs/:id", async (req, res, next) => {
  try { await BroadcastLog.findByIdAndDelete(req.params.id); res.json({ ok: true, success: true }); } catch (err) { next(err); }
});

// ── Lên lịch ───────────────────────────────────────────────────────
router.post("/schedule", requireSendPermission(), async (req, res, next) => {
  try {
    const { title, message, adminNote, attachmentIds, videoAttachmentId, fileAttachmentId, linkUrl, linkTitle, userIds, groupIds, scheduledAt } = req.body;
    if (!scheduledAt) return fail(res, "Cần chọn thời gian gửi");
    const date = new Date(scheduledAt);
    if (isNaN(date.getTime())) return fail(res, "Thời gian không hợp lệ");
    if (date <= new Date()) return fail(res, "Thời gian gửi phải ở tương lai");
    const allRecipients = [...(userIds || []), ...(groupIds || [])];
    if (!allRecipients.length) return fail(res, "Cần ít nhất 1 người nhận hoặc nhóm");
    const hasContent = message || attachmentIds?.length || videoAttachmentId || fileAttachmentId || linkUrl;
    if (!hasContent) return fail(res, "Cần nội dung, ảnh, video, file hoặc link");
    const doc = await ScheduledBroadcast.create({
      title: title || "", message: message || "", adminNote: adminNote || "",
      attachmentIds: attachmentIds || [], videoAttachmentId: videoAttachmentId || null, fileAttachmentId: fileAttachmentId || null,
      linkUrl: linkUrl || "", linkTitle: linkTitle || "",
      userIds: userIds || [], groupIds: groupIds || [],
      scheduledAt: date, createdBy: req.user?.username || "",
    });
    res.json({ ok: true, success: true, id: doc._id });
  } catch (err) { next(err); }
});

router.get("/schedule", async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const docs = await ScheduledBroadcast.find().sort({ scheduledAt: 1 }).limit(limit).lean();
    res.json({ schedules: docs.map((d) => ({ id: d._id, ...d })) });
  } catch (err) { next(err); }
});

router.delete("/schedule/:id", async (req, res, next) => {
  try {
    const doc = await ScheduledBroadcast.findById(req.params.id);
    if (!doc) return res.status(404).json({ success: false, error: "Không tìm thấy" });
    if (doc.status !== "pending") return fail(res, "Chỉ hủy được lịch đang chờ");
    doc.status = "cancelled";
    await doc.save();
    res.json({ ok: true, success: true });
  } catch (err) { next(err); }
});

// ── "Nội dung" — Broadcast kiểu Zalo OA Manager ────────────────────
// Upload ảnh: vừa Cloudinary (thumbnail URL cho bảng) vừa Zalo (attachment_id để gửi trong tin)
router.post("/posts/upload-image", (req, res) => {
  const upload = makeUpload("bcpost", {
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_, file, cb) => (file.mimetype.startsWith("image/") ? cb(null, true) : cb(new Error("Chỉ nhận ảnh"))),
  }).single("image");
  upload(req, res, async (err) => {
    if (err) return fail(res, err.message);
    if (!req.file) return fail(res, "Không có ảnh");
    try {
      const [imageAttachmentId, thumbnail] = await Promise.all([
        uploadImageToZalo(req.file.path),
        uploadFromBuffer(fs.readFileSync(req.file.path), `bcpost_${Date.now()}`),
      ]);
      fs.unlink(req.file.path, () => {});
      ok(res, { imageAttachmentId, thumbnail });
    } catch (e) {
      fs.unlink(req.file.path, () => {});
      fail(res, e.message, 500);
    }
  });
});

// Tạo broadcast (gửi nền) — gửi tới follower (userIds) và/hoặc nhóm Zalo (groupIds)
router.post("/posts", requireSendPermission(), async (req, res, next) => {
  try {
    const { name, content, thumbnail, imageAttachmentId, linkUrl, linkTitle, articles = [], userIds = [], groupIds = [] } = req.body;
    if (!name?.trim()) return fail(res, "Cần tên broadcast");
    if (!userIds.length && !groupIds.length) return fail(res, "Cần chọn đối tượng nhận (follower hoặc nhóm)");
    if (!articles.length && !content?.trim() && !imageAttachmentId && !linkUrl) return fail(res, "Cần nội dung, ảnh, link hoặc bài viết");
    const r = await sendBroadcastPost({ name, content, thumbnail, imageAttachmentId, linkUrl, linkTitle, articles, userIds, groupIds, createdBy: req.user?.id });
    ok(res, { ...r, total: userIds.length + groupIds.length });
  } catch (err) { next(err); }
});

// Tiến độ job tạo broadcast
router.get("/posts/status/:jobId", (req, res) => {
  const job = getPostJob(req.params.jobId);
  if (!job) return fail(res, "Không tìm thấy job", 404);
  res.json(job);
});

// Xuất thống kê CSV
router.get("/posts/export", async (req, res, next) => {
  try {
    const docs = await Broadcast.find().sort({ publishedAt: -1 }).limit(2000).lean();
    const label = (s) => (s === "success" ? "Thành công" : s === "failed" ? "Không gửi được" : "Đang gửi");
    const rows = [["STT", "Thời gian xuất bản", "Tên broadcast", "Đã gửi", "Lượt xem", "Trạng thái"]];
    docs.forEach((d, i) => rows.push([i + 1, new Date(d.publishedAt).toLocaleString("vi-VN"), d.name || "", d.sent, d.views, label(d.status)]));
    const csv = "﻿" + rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="broadcast-thong-ke.csv"');
    res.send(csv);
  } catch (err) { next(err); }
});

// Danh sách broadcast (lọc tên/trạng thái/thời gian) cho bảng Quản lý
router.get("/posts", async (req, res, next) => {
  try {
    const { q, status, from, to, page = 1 } = req.query;
    const limit = 20;
    const skip = (parseInt(page) - 1) * limit;
    const filter = {};
    if (q) filter.name = { $regex: String(q).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
    if (status) filter.status = status;
    if (from || to) {
      filter.publishedAt = {};
      if (from) filter.publishedAt.$gte = new Date(from);
      if (to) filter.publishedAt.$lte = new Date(String(to) + "T23:59:59");
    }
    const [items, total] = await Promise.all([
      Broadcast.find(filter).sort({ publishedAt: -1 }).skip(skip).limit(limit).lean(),
      Broadcast.countDocuments(filter),
    ]);
    ok(res, { items, total, page: parseInt(page), totalPages: Math.ceil(total / limit) });
  } catch (err) { next(err); }
});

router.delete("/posts/:id", async (req, res) => {
  try { await Broadcast.findByIdAndDelete(req.params.id); ok(res, { ok: true }); }
  catch (e) { fail(res, e.message, 500); }
});

// Zalo article/getslice giới hạn limit tối đa = 10 → gom hết bằng cách tải
// song song từng cụm 6 trang (60 bài), dừng khi hết. cap 400 phòng OA nhiều bài.
async function fetchAllArticles(type, cap = 400) {
  const out = [];
  for (let base = 0; base < cap; base += 60) {
    const offs = [];
    for (let o = base; o < base + 60 && o < cap; o += 10) offs.push(o);
    const pages = await Promise.all(
      offs.map((o) => getArticleSlice(type, o, 10).then((m) => m.map((a) => ({ ...a, type }))).catch(() => []))
    );
    let short = false;
    for (const p of pages) { out.push(...p); if (p.length < 10) short = true; }
    if (short) break;
  }
  return out;
}

// Kéo bài viết/broadcast THẬT trên OA Manager về (Zalo Article API)
router.get("/zalo-articles", async (req, res, next) => {
  try {
    const { type } = req.query; // "normal" | "video" | undefined = cả hai
    const types = type ? [type] : ["normal", "video"];
    const results = await Promise.all(types.map((t) => fetchAllArticles(t)));
    const items = results.flat()
      .map((a) => ({
        id: a.id, type: a.type, title: a.title, thumb: a.thumb, status: a.status,
        totalView: a.total_view || 0, totalShare: a.total_share || 0,
        totalLike: a.total_like || 0, totalComment: a.total_comment || 0,
        createDate: a.create_date, linkView: a.link_view,
      }))
      .sort((x, y) => (y.createDate || 0) - (x.createDate || 0));
    ok(res, { items });
  } catch (err) { next(err); }
});

// Đọc nội dung 1 bài viết trên OA
router.get("/zalo-articles/:id", async (req, res, next) => {
  try {
    const d = await getArticleDetail(req.params.id);
    ok(res, {
      id: d?.id, type: d?.type, title: d?.title, author: d?.author, description: d?.description,
      cover: d?.cover?.photo_url || "", status: d?.status, body: d?.body || [],
      totalView: d?.total_view || 0, totalShare: d?.total_share || 0, totalLike: d?.total_like || 0, totalComment: d?.total_comment || 0,
      linkView: d?.link_view || "",
    });
  } catch (err) { next(err); }
});

// ── Tạo broadcast/bài viết THẬT lên OA (Zalo Article API) ──────────
const escHtml = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const toArticleHtml = (text) =>
  String(text || "").split(/\n+/).map((l) => l.trim()).filter(Boolean).map((l) => `<p>${escHtml(l)}</p>`).join("") || "<p></p>";

// Upload ảnh cho bài viết → Cloudinary (URL công khai để Zalo tự host lại)
router.post("/articles/upload-image", (req, res) => {
  const upload = makeUpload("article", {
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_, file, cb) => (file.mimetype.startsWith("image/") ? cb(null, true) : cb(new Error("Chỉ nhận ảnh"))),
  }).single("image");
  upload(req, res, async (err) => {
    if (err) return fail(res, err.message);
    if (!req.file) return fail(res, "Không có ảnh");
    try {
      const url = await uploadFromBuffer(fs.readFileSync(req.file.path), `article_${Date.now()}`);
      fs.unlink(req.file.path, () => {});
      ok(res, { url });
    } catch (e) {
      fs.unlink(req.file.path, () => {});
      fail(res, e.message, 500);
    }
  });
});

// Đăng bài viết/broadcast lên OA
router.post("/articles", requireSendPermission(), async (req, res, next) => {
  try {
    const { title, author, description, coverUrl, blocks, status, comment } = req.body;
    if (!title?.trim()) return fail(res, "Cần tiêu đề");
    if (!coverUrl) return fail(res, "Cần ảnh bìa");
    const body = (Array.isArray(blocks) ? blocks : [])
      .map((b) => {
        if (b?.type === "image" && b.url) return { type: "image", url: b.url, caption: b.caption || "" };
        if (b?.type === "text" && String(b.content || "").trim()) return { type: "text", content: toArticleHtml(b.content) };
        return null;
      })
      .filter(Boolean);
    if (!body.length) return fail(res, "Cần nội dung (đoạn văn hoặc ảnh)");
    const data = await createArticle({
      type: "normal",
      title: title.trim(),
      author: author || "",
      description: description || "",
      status: status === "hide" ? "hide" : "show",
      comment: comment === "hide" ? "hide" : "show",
      cover: { cover_type: "photo", photo_url: coverUrl, status: "show" },
      body,
    });
    ok(res, { ok: true, token: data?.token });
  } catch (err) { next(err); }
});

// Xóa bài viết khỏi OA
router.delete("/articles/:id", async (req, res) => {
  try { await removeArticle(req.params.id); ok(res, { ok: true }); }
  catch (e) { fail(res, e.message, 500); }
});

module.exports = router;
