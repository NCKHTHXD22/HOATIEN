const router = require("express").Router();
const path = require("path");
const multer = require("multer");
const { authenticate, requireRole, requireSendPermission } = require("../middlewares/auth.middleware");
const { ok, created, fail, notFound, paginated } = require("../utils/response");
const NotificationRepo = require("../repositories/pg/NotificationRepo");
const RecipientGroupRepo = require("../repositories/pg/RecipientGroupRepo");
const SurveyRepo = require("../repositories/pg/SurveyRepo");
const NotificationService = require("../services/NotificationService");
const { prisma } = require("../config/database");

const SENDER_ROLES = ["SUPER_ADMIN", "ADMIN_VILLAGE"];

// ── Upload config ──────────────────────────────────────────
const storage = multer.diskStorage({
  destination: path.join(__dirname, "../../uploads"),
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
    cb(null, `${unique}-${file.originalname}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowed = [".pdf", ".jpg", ".jpeg", ".png", ".docx", ".xlsx"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error("Định dạng file không được hỗ trợ"));
  },
});

function detectFileType(filename) {
  const ext = path.extname(filename).toLowerCase();
  if ([".jpg", ".jpeg", ".png"].includes(ext)) return "IMAGE";
  if (ext === ".pdf") return "PDF";
  if ([".docx", ".xlsx"].includes(ext)) return "DOC";
  return "OTHER";
}

// ── NOTIFICATIONS ──────────────────────────────────────────

// GET /api/notify/notifications
router.get("/notifications", authenticate, async (req, res, next) => {
  try {
    const { page = 1, limit = 20, trangThai, search } = req.query;
    const [rows, total] = await NotificationRepo.findMany({ page, limit, trangThai, search });
    paginated(res, rows, total, page, limit);
  } catch (err) { next(err); }
});

// POST /api/notify/notifications
router.post("/notifications", authenticate, requireRole(...SENDER_ROLES), async (req, res, next) => {
  try {
    const { tieuDe, noiDung, kenhGui = [], memberIds = [], groupIds = [], followerIds = [] } = req.body;
    if (!tieuDe || !noiDung) return fail(res, "Tiêu đề và nội dung là bắt buộc");
    if (kenhGui.length === 0) return fail(res, "Phải chọn ít nhất 1 kênh gửi");
    if (memberIds.length === 0 && groupIds.length === 0 && followerIds.length === 0) {
      return fail(res, "Phải chọn ít nhất 1 người nhận, nhóm hoặc follower");
    }

    const notif = await NotificationRepo.create({
      tieuDe,
      noiDung,
      kenhGui,
      createdBy: req.user.id,
    });

    const recipientData = [
      ...memberIds.map((memberId) => ({ notificationId: notif.id, memberId })),
      ...groupIds.map((groupId) => ({ notificationId: notif.id, groupId })),
    ];
    if (recipientData.length > 0) {
      await NotificationRepo.addRecipients(recipientData);
    }

    created(res, notif, "Đã lưu bản nháp");
  } catch (err) { next(err); }
});

// GET /api/notify/notifications/:id
router.get("/notifications/:id", authenticate, async (req, res, next) => {
  try {
    const notif = await NotificationRepo.findById(req.params.id);
    if (!notif) return notFound(res, "Không tìm thấy thông báo");
    ok(res, notif);
  } catch (err) { next(err); }
});

// PUT /api/notify/notifications/:id
router.put("/notifications/:id", authenticate, requireRole(...SENDER_ROLES), async (req, res, next) => {
  try {
    const notif = await NotificationRepo.findById(req.params.id);
    if (!notif) return notFound(res);
    if (notif.trangThai !== "NHAP") return fail(res, "Chỉ có thể sửa bản nháp");

    const { tieuDe, noiDung, kenhGui, memberIds, groupIds } = req.body;
    const updated = await NotificationRepo.update(req.params.id, {
      ...(tieuDe && { tieuDe }),
      ...(noiDung && { noiDung }),
      ...(kenhGui && { kenhGui }),
    });

    if (memberIds !== undefined || groupIds !== undefined) {
      await NotificationRepo.clearRecipients(req.params.id);
      const recipientData = [
        ...(memberIds || []).map((memberId) => ({ notificationId: req.params.id, memberId })),
        ...(groupIds || []).map((groupId) => ({ notificationId: req.params.id, groupId })),
      ];
      if (recipientData.length > 0) await NotificationRepo.addRecipients(recipientData);
    }

    ok(res, updated);
  } catch (err) { next(err); }
});

// DELETE /api/notify/notifications/:id
router.delete("/notifications/:id", authenticate, requireRole(...SENDER_ROLES), async (req, res, next) => {
  try {
    const notif = await NotificationRepo.findById(req.params.id);
    if (!notif) return notFound(res);
    if (!["NHAP", "DA_HUY"].includes(notif.trangThai)) {
      return fail(res, "Chỉ có thể xóa bản nháp hoặc đã hủy");
    }
    await NotificationRepo.remove(req.params.id);
    ok(res, null, "Đã xóa");
  } catch (err) { next(err); }
});

// POST /api/notify/notifications/:id/send  — gửi ngay
router.post("/notifications/:id/send", authenticate, requireSendPermission(), async (req, res, next) => {
  try {
    await NotificationService.execute(req.params.id);
    ok(res, null, "Đã gửi thông báo");
  } catch (err) { next(err); }
});

// POST /api/notify/notifications/:id/schedule  — lên lịch
router.post("/notifications/:id/schedule", authenticate, requireSendPermission(), async (req, res, next) => {
  try {
    const { scheduledAt } = req.body;
    if (!scheduledAt) return fail(res, "Cần cung cấp thời gian gửi");
    const date = new Date(scheduledAt);
    if (date <= new Date()) return fail(res, "Thời gian gửi phải trong tương lai");

    const notif = await NotificationRepo.findById(req.params.id);
    if (!notif) return notFound(res);
    if (notif.trangThai !== "NHAP") return fail(res, "Chỉ lên lịch được bản nháp");

    const updated = await NotificationRepo.update(req.params.id, {
      trangThai: "CHO_GUI",
      scheduledAt: date,
    });
    ok(res, updated, "Đã lên lịch gửi");
  } catch (err) { next(err); }
});

// POST /api/notify/notifications/:id/cancel  — hủy lịch
router.post("/notifications/:id/cancel", authenticate, requireSendPermission(), async (req, res, next) => {
  try {
    const notif = await NotificationRepo.findById(req.params.id);
    if (!notif) return notFound(res);
    if (notif.trangThai !== "CHO_GUI") return fail(res, "Chỉ hủy được thông báo đang chờ gửi");
    const updated = await NotificationRepo.update(req.params.id, {
      trangThai: "NHAP",
      scheduledAt: null,
    });
    ok(res, updated, "Đã hủy lịch gửi");
  } catch (err) { next(err); }
});

// GET /api/notify/notifications/:id/sends  — trạng thái gửi
router.get("/notifications/:id/sends", authenticate, async (req, res, next) => {
  try {
    const sends = await NotificationRepo.findSends(req.params.id);
    ok(res, sends);
  } catch (err) { next(err); }
});

// POST /api/notify/sends/:sendId/confirm  — xác nhận đã nhận
router.post("/sends/:sendId/confirm", authenticate, async (req, res, next) => {
  try {
    const updated = await NotificationRepo.updateSend(req.params.sendId, {
      trangThai: "CONFIRMED",
      readAt: new Date(),
    });
    ok(res, updated, "Đã xác nhận");
  } catch (err) { next(err); }
});

// POST /api/notify/sends/:sendId/feedback  — gửi phản hồi
router.post("/sends/:sendId/feedback", authenticate, async (req, res, next) => {
  try {
    const { noiDung } = req.body;
    if (!noiDung) return fail(res, "Nội dung phản hồi không được để trống");
    const fb = await NotificationRepo.createFeedback({
      sendId: req.params.sendId,
      noiDung,
      nguon: "ADMIN",
    });
    created(res, fb, "Đã lưu phản hồi");
  } catch (err) { next(err); }
});

// POST /api/notify/notifications/:id/attachments  — upload file đính kèm
router.post(
  "/notifications/:id/attachments",
  authenticate,
  requireRole(...SENDER_ROLES),
  upload.single("file"),
  async (req, res, next) => {
    try {
      if (!req.file) return fail(res, "Không có file được upload");
      const attachment = await NotificationRepo.addAttachment({
        notificationId: req.params.id,
        tenFile: req.file.originalname,
        url: `/uploads/${req.file.filename}`,
        loai: detectFileType(req.file.originalname),
        sizeByte: req.file.size,
      });
      created(res, attachment, "Đã đính kèm file");
    } catch (err) { next(err); }
  }
);

// GET /api/notify/reports  — báo cáo hiệu quả
router.get("/reports", authenticate, async (req, res, next) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const stats = await NotificationRepo.getStats(days);
    ok(res, stats);
  } catch (err) { next(err); }
});

// ── RECIPIENT GROUPS ───────────────────────────────────────

// GET /api/notify/groups
router.get("/groups", authenticate, async (req, res, next) => {
  try {
    const groups = await RecipientGroupRepo.findAll(req.user.id, req.user.role);
    ok(res, groups);
  } catch (err) { next(err); }
});

// POST /api/notify/groups
router.post("/groups", authenticate, requireRole(...SENDER_ROLES), async (req, res, next) => {
  try {
    const { ten, moTa, loai = "MANUAL", tieuChi, memberIds = [] } = req.body;
    if (!ten) return fail(res, "Tên nhóm là bắt buộc");

    const group = await RecipientGroupRepo.create({
      ten, moTa, loai,
      tieuChi: tieuChi || null,
      createdBy: req.user.id,
    });

    if (loai === "AUTO" && tieuChi) {
      await RecipientGroupRepo.buildAutoGroup(group.id, tieuChi);
    } else if (memberIds.length > 0) {
      await RecipientGroupRepo.addMembers(group.id, memberIds);
    }

    const full = await RecipientGroupRepo.findById(group.id);
    created(res, full, "Đã tạo nhóm");
  } catch (err) { next(err); }
});

// GET /api/notify/groups/:id
router.get("/groups/:id", authenticate, async (req, res, next) => {
  try {
    const group = await RecipientGroupRepo.findById(req.params.id);
    if (!group) return notFound(res, "Không tìm thấy nhóm");
    ok(res, group);
  } catch (err) { next(err); }
});

// PUT /api/notify/groups/:id
router.put("/groups/:id", authenticate, requireRole(...SENDER_ROLES), async (req, res, next) => {
  try {
    const { ten, moTa } = req.body;
    const updated = await RecipientGroupRepo.update(req.params.id, { ten, moTa });
    ok(res, updated);
  } catch (err) { next(err); }
});

// DELETE /api/notify/groups/:id
router.delete("/groups/:id", authenticate, requireRole(...SENDER_ROLES), async (req, res, next) => {
  try {
    await RecipientGroupRepo.remove(req.params.id);
    ok(res, null, "Đã xóa nhóm");
  } catch (err) { next(err); }
});

// POST /api/notify/groups/:id/members  — thêm thành viên
router.post("/groups/:id/members", authenticate, requireRole(...SENDER_ROLES), async (req, res, next) => {
  try {
    const { memberIds = [] } = req.body;
    if (memberIds.length === 0) return fail(res, "Danh sách thành viên không được rỗng");
    await RecipientGroupRepo.addMembers(req.params.id, memberIds);
    ok(res, null, `Đã thêm ${memberIds.length} thành viên`);
  } catch (err) { next(err); }
});

// DELETE /api/notify/groups/:id/members  — xóa thành viên
router.delete("/groups/:id/members", authenticate, requireRole(...SENDER_ROLES), async (req, res, next) => {
  try {
    const { memberIds = [] } = req.body;
    await RecipientGroupRepo.removeMembers(req.params.id, memberIds);
    ok(res, null, "Đã xóa thành viên khỏi nhóm");
  } catch (err) { next(err); }
});

// POST /api/notify/groups/:id/rebuild  — dựng lại nhóm AUTO
router.post("/groups/:id/rebuild", authenticate, requireRole(...SENDER_ROLES), async (req, res, next) => {
  try {
    const group = await RecipientGroupRepo.findById(req.params.id);
    if (!group) return notFound(res);
    if (group.loai !== "AUTO") return fail(res, "Chỉ áp dụng cho nhóm AUTO");
    const count = await RecipientGroupRepo.buildAutoGroup(req.params.id, group.tieuChi);
    ok(res, { count }, `Đã cập nhật ${count} thành viên`);
  } catch (err) { next(err); }
});

// GET /api/notify/members  — danh sách nhân khẩu (để chọn người nhận)
router.get("/members", authenticate, async (req, res, next) => {
  try {
    const { search, villageId, page = 1, limit = 50 } = req.query;
    const where = { trangThai: "ACTIVE" };
    if (search) where.hoTen = { contains: search, mode: "insensitive" };
    if (villageId) where.household = { villageId };
    else if (req.user.role === "ADMIN_VILLAGE" && req.user.villageIds?.length) {
      where.household = { villageId: { in: req.user.villageIds } };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [rows, total] = await Promise.all([
      prisma.member.findMany({
        where,
        skip,
        take: parseInt(limit),
        select: {
          id: true, hoTen: true, sdt: true, email: true, zaloUserId: true, gioiTinh: true,
          household: { select: { village: { select: { ten: true } } } },
        },
        orderBy: { hoTen: "asc" },
      }),
      prisma.member.count({ where }),
    ]);
    paginated(res, rows, total, page, limit);
  } catch (err) { next(err); }
});

// ── SURVEYS ────────────────────────────────────────────────

// GET /api/notify/surveys
router.get("/surveys", authenticate, async (req, res, next) => {
  try {
    const surveys = await SurveyRepo.findAll();
    ok(res, surveys);
  } catch (err) { next(err); }
});

// POST /api/notify/surveys
router.post("/surveys", authenticate, requireRole(...SENDER_ROLES), async (req, res, next) => {
  try {
    const { tieuDe, notificationId, deadline, questions = [] } = req.body;
    if (!tieuDe) return fail(res, "Tiêu đề khảo sát là bắt buộc");
    if (questions.length === 0) return fail(res, "Phải có ít nhất 1 câu hỏi");
    const survey = await SurveyRepo.create({ tieuDe, notificationId, deadline, questions });
    created(res, survey, "Đã tạo khảo sát");
  } catch (err) { next(err); }
});

// GET /api/notify/surveys/:id
router.get("/surveys/:id", authenticate, async (req, res, next) => {
  try {
    const survey = await SurveyRepo.findById(req.params.id);
    if (!survey) return notFound(res);
    ok(res, survey);
  } catch (err) { next(err); }
});

// GET /api/notify/surveys/:id/results
router.get("/surveys/:id/results", authenticate, async (req, res, next) => {
  try {
    const results = await SurveyRepo.getResults(req.params.id);
    if (!results) return notFound(res);
    ok(res, results);
  } catch (err) { next(err); }
});

// GET /api/notify/surveys/:id/public — lấy khảo sát để điền (KHÔNG cần auth, không trả kết quả)
router.get("/surveys/:id/public", async (req, res, next) => {
  try {
    const survey = await SurveyRepo.findById(req.params.id);
    if (!survey) return notFound(res, "Không tìm thấy khảo sát");
    ok(res, {
      id: survey.id,
      tieuDe: survey.tieuDe,
      isActive: survey.isActive,
      deadline: survey.deadline,
      questions: (survey.questions || []).map((q) => ({
        id: q.id, cauHoi: q.cauHoi, loai: q.loai, luaChon: q.luaChon, thuTu: q.thuTu,
      })),
    });
  } catch (err) { next(err); }
});

// POST /api/notify/surveys/:id/respond  — trả lời khảo sát (không cần auth)
router.post("/surveys/:id/respond", async (req, res, next) => {
  try {
    const survey = await SurveyRepo.findById(req.params.id);
    if (!survey) return notFound(res);
    if (!survey.isActive) return fail(res, "Khảo sát đã đóng");
    if (survey.deadline && new Date() > new Date(survey.deadline)) {
      return fail(res, "Khảo sát đã hết hạn");
    }
    const { answers, memberId } = req.body;
    if (!answers) return fail(res, "Thiếu câu trả lời");
    const resp = await SurveyRepo.addResponse({ surveyId: req.params.id, memberId, answers });
    created(res, resp, "Đã ghi nhận phản hồi");
  } catch (err) { next(err); }
});

// DELETE /api/notify/surveys/:id
router.delete("/surveys/:id", authenticate, requireRole("SUPER_ADMIN", "ADMIN_VILLAGE"), async (req, res, next) => {
  try {
    await SurveyRepo.remove(req.params.id);
    ok(res, null, "Đã xóa khảo sát");
  } catch (err) { next(err); }
});

module.exports = router;
