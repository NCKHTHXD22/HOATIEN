const router = require("express").Router();
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const { authenticate, requireRole, requireSendPermission } = require("../middlewares/auth.middleware");
const { ok, fail } = require("../utils/response");
const ZaloFollowerRepo = require("../repositories/mongo/ZaloFollowerRepo");
const ZaloService = require("../services/ZaloService");
const ZaloGroup = require("../models/mongo/ZaloGroup");
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

// ── Groups (nhóm Zalo theo group_id) ───────────────────────────────
router.get("/groups", async (req, res, next) => {
  try {
    const docs = await ZaloGroup.find().sort({ name: 1 }).lean();
    const groups = docs.map((g) => ({ group_id: g.groupId, name: g.name }));
    ok(res, { groups, count: groups.length });
  } catch (err) { next(err); }
});

router.post("/groups", async (req, res, next) => {
  try {
    const { group_id, name } = req.body;
    if (!group_id || !group_id.trim()) return fail(res, "Cần group_id");
    await ZaloGroup.findOneAndUpdate(
      { groupId: group_id.trim() },
      { $set: { name: (name || "").trim() || group_id.trim() } },
      { upsert: true }
    );
    const docs = await ZaloGroup.find().sort({ name: 1 }).lean();
    ok(res, { ok: true, groups: docs.map((g) => ({ group_id: g.groupId, name: g.name })), count: docs.length });
  } catch (err) { next(err); }
});

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
    const docs = await ZaloGroup.find().sort({ name: 1 }).lean();
    ok(res, { ok: true, groups: docs.map((g) => ({ group_id: g.groupId, name: g.name })), count: docs.length });
  } catch (err) { next(err); }
});

router.delete("/groups/:id", async (req, res, next) => {
  try {
    await ZaloGroup.deleteOne({ groupId: req.params.id });
    const docs = await ZaloGroup.find().sort({ name: 1 }).lean();
    ok(res, { ok: true, groups: docs.map((g) => ({ group_id: g.groupId, name: g.name })), count: docs.length });
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
