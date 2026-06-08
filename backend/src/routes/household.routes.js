const router = require("express").Router();
const { body } = require("express-validator");
const HouseholdService = require("../services/HouseholdService");
const AuditService = require("../services/AuditService");
const SearchService = require("../services/SearchService");
const HouseholdRepo = require("../repositories/pg/HouseholdRepo");
const { authenticate, requireRole } = require("../middlewares/auth.middleware");
const { validate } = require("../middlewares/validate.middleware");
const { ok, created, fail, paginated } = require("../utils/response");

router.use(authenticate);

// GET /api/households?villageId=&trangThai=&page=&limit=
router.get("/", async (req, res, next) => {
  try {
    const { villageId, trangThai, loaiHo, page = 1, limit = 20 } = req.query;
    const { data, total } = await HouseholdService.getAll({ villageId, trangThai, loaiHo, page, limit });
    paginated(res, data, total, page, limit);
  } catch (err) { next(err); }
});

// GET /api/households/search?q=
router.get("/search", async (req, res, next) => {
  try {
    const { q } = req.query;
    if (!q) return fail(res, "Thiếu từ khóa tìm kiếm");
    const ids = await SearchService.searchByText(q);
    const households = ids.length ? await HouseholdRepo.findByIds(ids) : [];
    ok(res, households);
  } catch (err) { next(err); }
});

// POST /api/households/merge
router.post(
  "/merge",
  requireRole("SUPER_ADMIN", "ADMIN_VILLAGE"),
  [
    body("targetId").notEmpty().withMessage("Hộ nhận (targetId) là bắt buộc"),
    body("sourceIds").isArray({ min: 1 }).withMessage("Cần chọn ít nhất 1 hộ nguồn để gộp"),
    body("sourceIds.*").isString().withMessage("sourceIds phải là mảng chuỗi ID"),
    body("ghiChu").optional().isString(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const result = await HouseholdService.mergeHouseholds(req.body, req.user.id);
      ok(res, result, `Gộp ${result.mergedCount} hộ thành công, chuyển ${result.membersMoved} nhân khẩu`);
    } catch (err) { next(err); }
  }
);

// GET /api/households/:id
router.get("/:id", async (req, res, next) => {
  try { ok(res, await HouseholdService.getById(req.params.id)); } catch (err) { next(err); }
});

// GET /api/households/:id/history
router.get("/:id/history", async (req, res, next) => {
  try {
    const history = await AuditService.getHistory("household", req.params.id);
    ok(res, history);
  } catch (err) { next(err); }
});

// POST /api/households
router.post(
  "/",
  requireRole("SUPER_ADMIN", "ADMIN_VILLAGE"),
  [
    body("soHoKhau").notEmpty().withMessage("Số hộ khẩu là bắt buộc"),
    body("diaChi").notEmpty().withMessage("Địa chỉ là bắt buộc"),
    body("villageId").notEmpty().withMessage("Thôn là bắt buộc"),
    body("loaiHo").optional().isIn(["THUONG_TRU", "TAM_TRU", "TAM_VANG"]),
    body("members").optional().isArray(),
  ],
  validate,
  async (req, res, next) => {
    try { created(res, await HouseholdService.create(req.body, req.user.id), "Tạo hộ dân thành công"); } catch (err) { next(err); }
  }
);

// PUT /api/households/:id
router.put(
  "/:id",
  requireRole("SUPER_ADMIN", "ADMIN_VILLAGE"),
  async (req, res, next) => {
    try { ok(res, await HouseholdService.update(req.params.id, req.body, req.user.id)); } catch (err) { next(err); }
  }
);

// DELETE /api/households/:id
router.delete("/:id", requireRole("SUPER_ADMIN"), async (req, res, next) => {
  try { await HouseholdService.remove(req.params.id, req.user.id); ok(res, null, "Đã xóa hộ dân"); } catch (err) { next(err); }
});

// POST /api/households/:id/split
router.post(
  "/:id/split",
  requireRole("SUPER_ADMIN", "ADMIN_VILLAGE"),
  [
    body("memberIds").isArray({ min: 1 }).withMessage("Cần chọn ít nhất 1 thành viên để tách"),
    body("newHeadId").optional().isString(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const result = await HouseholdService.splitHousehold(
        { sourceId: req.params.id, ...req.body },
        req.user.id
      );
      ok(res, result, "Tách hộ thành công");
    } catch (err) { next(err); }
  }
);

module.exports = router;
