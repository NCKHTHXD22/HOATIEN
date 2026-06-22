const router = require("express").Router();
const multer = require("multer");
const { prisma } = require("../config/database");
const Feedback = require("../models/mongo/Feedback");
const { authenticate, requireRole } = require("../middlewares/auth.middleware");
const { sendText } = require("../utils/zaloBroadcast");
const { uploadFromBuffer, uploadVideoFromBuffer, uploadRawFromBuffer } = require("../utils/cloudinaryUpload");
const InAppAlertService = require("../services/InAppAlertService");

const memoryUpload = multer({ storage: multer.memoryStorage() });
const LEADER_ROLES = ["SUPER_ADMIN", "DEPT_LEADER"];

router.use(authenticate);

// categoryIds của DEPT_LEADER (null = xem tất cả). Lấy từ Postgres.
async function myCats(u) {
  if (u.role !== "DEPT_LEADER") return null;
  const row = await prisma.adminUser.findUnique({ where: { id: u.id }, select: { categoryIds: true } });
  const ids = row?.categoryIds || [];
  return ids.length ? ids : null;
}
async function baseFilter(u) {
  if (u.role === "SUPER_ADMIN" || u.role === "VIEWER") return {};
  if (u.role === "DEPT_LEADER") { const c = await myCats(u); return c ? { categoryId: { $in: c } } : {}; }
  return { assignedTo: u.id }; // OFFICER / ADMIN_VILLAGE
}

// Resolve tên cán bộ (Postgres) cho các id trong feedback -> {_id, fullName}
async function _adminMap(ids) {
  const uniq = [...new Set(ids.filter(Boolean).map(String))];
  if (!uniq.length) return {};
  const rows = await prisma.adminUser.findMany({ where: { id: { in: uniq } }, select: { id: true, hoTen: true } });
  return Object.fromEntries(rows.map((r) => [r.id, { _id: r.id, fullName: r.hoTen }]));
}
function _enrich(fb, map) {
  return {
    ...fb,
    assignedTo: fb.assignedTo ? (map[fb.assignedTo] || { _id: fb.assignedTo, fullName: "?" }) : null,
    assignedBy: fb.assignedBy ? (map[fb.assignedBy] || { _id: fb.assignedBy, fullName: "?" }) : null,
    draftBy: fb.draftBy ? (map[fb.draftBy] || { _id: fb.draftBy, fullName: "?" }) : null,
    approvedBy: fb.approvedBy ? (map[fb.approvedBy] || { _id: fb.approvedBy, fullName: "?" }) : null,
    categoryId: fb.linhVuc ? { name: fb.linhVuc } : null,
  };
}
const isLeader = (u) => LEADER_ROLES.includes(u.role);
const canAccess = (u, fb) => isLeader(u) || u.role === "VIEWER" || String(fb.assignedTo || "") === String(u.id);

// GET /api/feedbacks/stats
router.get("/stats", async (req, res, next) => {
  try {
    const me = req.user;
    const base = await baseFilter(me);
    const [pending, processing, draft, resolved] = await Promise.all([
      Feedback.countDocuments({ ...base, status: "pending" }),
      Feedback.countDocuments({ ...base, status: "processing" }),
      Feedback.countDocuments({ ...base, status: "draft" }),
      Feedback.countDocuments({ ...base, status: { $in: ["resolved", "done"] } }),
    ]);
    res.json({ pending, processing, draft, resolved });
  } catch (err) { next(err); }
});

// GET /api/feedbacks
router.get("/", async (req, res, next) => {
  try {
    const { status, q, page = 1 } = req.query;
    const limit = 20;
    const skip = (parseInt(page) - 1) * limit;
    const filter = {};
    const me = req.user;
    Object.assign(filter, await baseFilter(me));
    if (status) filter.status = status;
    if (q) {
      const clean = q.replace(/^#/, "").trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const rx = new RegExp(clean, "i");
      filter.$or = [{ displayName: rx }, { contact: rx }, { content: rx }, { linhVuc: rx }];
    }
    const [feedbacks, total] = await Promise.all([
      Feedback.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Feedback.countDocuments(filter),
    ]);
    const map = await _adminMap(feedbacks.map((f) => f.assignedTo));
    res.json({
      feedbacks: feedbacks.map((f) => _enrich(f, map)),
      pagination: { page: parseInt(page), totalPages: Math.ceil(total / limit), total },
    });
  } catch (err) { next(err); }
});

// GET /api/feedbacks/:id
router.get("/:id", async (req, res, next) => {
  try {
    const fb = await Feedback.findById(req.params.id).lean();
    if (!fb) return res.status(404).json({ error: "Không tìm thấy phản ánh" });
    if (!canAccess(req.user, fb)) return res.status(403).json({ error: "Không có quyền truy cập" });
    const map = await _adminMap([fb.assignedTo, fb.assignedBy, fb.draftBy, fb.approvedBy]);
    let admins = [];
    if (isLeader(req.user)) {
      const rows = await prisma.adminUser.findMany({
        where: { role: { in: ["OFFICER", "DEPT_LEADER", "ADMIN_VILLAGE"] }, isActive: true },
        select: { id: true, hoTen: true, username: true, role: true },
      });
      admins = rows.map((r) => ({ _id: r.id, fullName: r.hoTen, username: r.username, role: r.role }));
    }
    res.json({ feedback: _enrich(fb, map), admins, categories: [] });
  } catch (err) { next(err); }
});

// POST /api/feedbacks/attachments/upload/image
router.post("/attachments/upload/image", (req, res) => {
  memoryUpload.array("images", 5)(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.files?.length) return res.status(400).json({ error: "Không có file" });
    if (req.files.some((f) => !f.mimetype.startsWith("image/"))) return res.status(400).json({ error: "Chỉ nhận ảnh" });
    try {
      const images = await Promise.all(req.files.map(async (f) => ({
        url: await uploadFromBuffer(f.buffer, `fb_${Date.now()}_${Math.round(Math.random() * 1e4)}`),
        name: f.originalname,
      })));
      res.json({ ok: true, images });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });
});

// POST /api/feedbacks/attachments/upload/video
router.post("/attachments/upload/video", (req, res) => {
  memoryUpload.single("video")(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: "Không có file video" });
    if (!req.file.mimetype.startsWith("video/")) return res.status(400).json({ error: "Chỉ nhận video" });
    try {
      const url = await uploadVideoFromBuffer(req.file.buffer, `fb_vid_${Date.now()}`);
      res.json({ url, name: req.file.originalname });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });
});

// POST /api/feedbacks/attachments/upload/file
router.post("/attachments/upload/file", (req, res) => {
  memoryUpload.single("file")(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: "Không có file đính kèm" });
    try {
      const url = await uploadRawFromBuffer(req.file.buffer, `fb_file_${Date.now()}`);
      res.json({ url, name: req.file.originalname });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });
});

// POST /api/feedbacks/:id/assign — lãnh đạo phân công
router.post("/:id/assign", requireRole(...LEADER_ROLES), async (req, res, next) => {
  try {
    const { assignedTo, note, images, deadline } = req.body;
    const fb = await Feedback.findById(req.params.id);
    if (!fb) return res.status(404).json({ error: "Không tìm thấy" });
    fb.assignedTo = assignedTo || null;
    fb.assignedBy = req.user.id;
    fb.assignNote = note?.trim() || "";
    if (deadline) fb.deadline = new Date(deadline);
    if (images?.length) fb.draftAttachments = { ...fb.draftAttachments, images };
    if (fb.status === "pending") fb.status = "processing";
    fb.updatedAt = new Date();
    await fb.save();
    InAppAlertService.notifyAssigned(fb, req.user.id).catch(() => {});
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// POST /api/feedbacks/:id/draft — cán bộ soạn dự thảo
router.post("/:id/draft", async (req, res, next) => {
  try {
    const { draftResponse, note, images } = req.body;
    if (!draftResponse?.trim()) return res.status(400).json({ error: "Nhập nội dung dự thảo" });
    const fb = await Feedback.findById(req.params.id);
    if (!fb) return res.status(404).json({ error: "Không tìm thấy" });
    if (!canAccess(req.user, fb)) return res.status(403).json({ error: "Không có quyền" });
    fb.draftResponse = draftResponse.trim();
    fb.draftBy = req.user.id;
    fb.draftAt = new Date();
    fb.status = "draft";
    fb.draftAttachments = { note: note?.trim() || "", images: images || [], sentBy: req.user.id, sentAt: new Date() };
    fb.updatedAt = new Date();
    await fb.save();
    InAppAlertService.notifyDraft(fb, req.user.id).catch(() => {});
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// POST /api/feedbacks/:id/approve — lãnh đạo duyệt + gửi dân
router.post("/:id/approve", requireRole(...LEADER_ROLES), async (req, res, next) => {
  try {
    const fb = await Feedback.findById(req.params.id);
    if (!fb) return res.status(404).json({ error: "Không tìm thấy" });
    if (fb.status !== "draft") return res.status(400).json({ error: "Chỉ duyệt được phản ánh ở trạng thái Dự thảo" });
    const finalResponse = (req.body.finalResponse?.trim()) || (fb.draftResponse || "").trim();
    if (!finalResponse) return res.status(400).json({ error: "Chưa có nội dung phản hồi" });
    await sendText(fb.userId, finalResponse);
    fb.finalResponse = finalResponse;
    fb.approvedBy = req.user.id;
    fb.sentAt = new Date();
    fb.status = "resolved";
    fb.updatedAt = new Date();
    await fb.save();
    InAppAlertService.notifyApproved(fb, req.user.id).catch(() => {});
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// POST /api/feedbacks/:id/reject — lãnh đạo từ chối dự thảo
router.post("/:id/reject", requireRole(...LEADER_ROLES), async (req, res, next) => {
  try {
    const fb = await Feedback.findById(req.params.id);
    if (!fb) return res.status(404).json({ error: "Không tìm thấy" });
    if (fb.status !== "draft") return res.status(400).json({ error: "Chỉ từ chối được phản ánh ở Dự thảo" });
    const rejectedReason = req.body.rejectedReason?.trim() || "";
    fb.rejectedReason = rejectedReason;
    fb.status = "processing";
    fb.updatedAt = new Date();
    await fb.save();
    InAppAlertService.notifyRejected(fb, req.user.id, rejectedReason).catch(() => {});
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// POST /api/feedbacks/:id/reply — lãnh đạo phản hồi trực tiếp (gửi dân ngay)
router.post("/:id/reply", requireRole(...LEADER_ROLES), async (req, res, next) => {
  try {
    const { response } = req.body;
    if (!response?.trim()) return res.status(400).json({ error: "Nhập nội dung phản hồi" });
    const fb = await Feedback.findById(req.params.id);
    if (!fb) return res.status(404).json({ error: "Không tìm thấy" });
    await sendText(fb.userId, response.trim());
    fb.finalResponse = response.trim();
    fb.approvedBy = req.user.id;
    fb.sentAt = new Date();
    fb.status = "resolved";
    fb.updatedAt = new Date();
    await fb.save();
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// DELETE /api/feedbacks/:id
router.delete("/:id", requireRole(...LEADER_ROLES), async (req, res, next) => {
  try { await Feedback.findByIdAndDelete(req.params.id); res.json({ ok: true }); } catch (err) { next(err); }
});

module.exports = router;
