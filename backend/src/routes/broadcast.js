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
const { uploadImageToZalo, uploadFileToZalo } = require("../utils/zaloBroadcast");
const env = require("../config/env");

const UPLOAD_DIR = path.join(__dirname, "../../uploads");
const PUBLIC_BASE = (env.CORS_ORIGINS || []).join(",").includes("dxvtech") ? "https://api.dxvtech.vn" : "https://api.dxvtech.vn";

// Mọi endpoint cần đăng nhập + vai trò quản trị
router.use(authenticate, requireRole("SUPER_ADMIN", "ADMIN_VILLAGE"));

// ── Followers (tái dùng hệ follower sẵn có của HOATIEN) ─────────────
router.get("/followers", async (req, res, next) => {
  try {
    const list = await ZaloFollowerRepo.findAll();
    const followers = list.map((f) => ({ user_id: f.userId, display_name: f.displayName || "", avatar: f.avatar || "", linkedMemberId: f.linkedMemberId || null }));
    ok(res, { followers, count: followers.length, syncing: ZaloService.isSyncing(), syncedAt: null });
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
  return docs.map((g) => ({ id: String(g._id), group_id: g.groupId, name: g.name, icon: g.icon || "📋", memberCount: cmap[g.groupId] || 0 }));
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
    const groupId = await zaloGmf.createZaloGroup(name.trim(), memberIds, name.trim());
    if (!groupId) return fail(res, "Zalo không trả về group_id", 500);
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
    let synced = 0;
    for (const m of members) {
      const uid = m.user_id || m.member_id || m.id;
      if (!uid) continue;
      await ZaloGroupMember.create({ groupId: req.params.groupId, zaloUserId: String(uid), displayName: m.display_name || "", avatar: m.avatar || "" }).catch(() => {});
      synced++;
    }
    res.json({ ok: true, synced });
  } catch (err) { next(err); }
});

// ── Duyệt thành viên chờ vào nhóm (GMF pending invite) ─────────────
const _normalizePending = (m) =>
  typeof m === "string"
    ? { id: m, name: "", avatar: "" }
    : {
        id: String(m.id || m.user_id || m.uid || ""),
        name: m.name || m.display_name || m.user_name || "",
        avatar: m.avatar || m.avatar_url || "",
      };

// Danh sách người đang chờ duyệt vào nhóm
router.get("/groups/:groupId/pending", async (req, res, next) => {
  try {
    const { members, total } = await zaloGmf.getPendingGroupMembers(req.params.groupId);
    res.json({ total, members: members.map(_normalizePending) });
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

module.exports = router;
