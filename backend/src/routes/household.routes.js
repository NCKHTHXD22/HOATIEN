const router = require("express").Router();
const multer = require("multer");
const crypto = require("crypto");
const { body } = require("express-validator");
const HouseholdService = require("../services/HouseholdService");
const AuditService = require("../services/AuditService");
const SearchService = require("../services/SearchService");
const HouseholdRepo = require("../repositories/pg/HouseholdRepo");
const { parseHouseholdExcel } = require("../utils/excelHouseholdImport");
const { authenticate, requireRole } = require("../middlewares/auth.middleware");
const { validate } = require("../middlewares/validate.middleware");
const { ok, created, fail, paginated } = require("../utils/response");

router.use(authenticate);

// Cache kết quả parse Excel giữa bước xem trước và bước ghi (RAM, TTL 10 phút)
const memoryUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
const importCache = new Map();
const IMPORT_TTL = 10 * 60 * 1000;
function putImport(parsed) {
  for (const [k, v] of importCache) if (Date.now() - v.at > IMPORT_TTL) importCache.delete(k);
  const token = crypto.randomBytes(12).toString("hex");
  importCache.set(token, { parsed, at: Date.now(), committed: false });
  return token;
}

// GET /api/households?villageId=&trangThai=&page=&limit=
router.get("/", async (req, res, next) => {
  try {
    const { villageId, trangThai, loaiHo, to, page = 1, limit = 20 } = req.query;
    const { data, total } = await HouseholdService.getAll({ villageId, trangThai, loaiHo, to, page, limit });
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

// GET /api/households/to-list?villageId=
router.get("/to-list", async (req, res, next) => {
  try {
    const { villageId } = req.query;
    ok(res, await HouseholdService.getDistinctTo(villageId));
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

// POST /api/households/import/preview — upload Excel, parse & xem trước (CHƯA ghi DB)
router.post("/import/preview", requireRole("SUPER_ADMIN", "ADMIN_VILLAGE"), (req, res) => {
  memoryUpload.single("file")(req, res, async (err) => {
    if (err) return fail(res, err.code === "LIMIT_FILE_SIZE" ? "File quá lớn (tối đa 5MB)" : err.message);
    if (!req.file) return fail(res, "Chưa chọn file Excel (.xlsx)");
    if (!/\.xlsx$/i.test(req.file.originalname)) return fail(res, "Chỉ nhận file .xlsx");
    try {
      const parsed = await parseHouseholdExcel(req.file.buffer);
      if (parsed.householdCount === 0) return fail(res, "Không đọc được hộ nào — kiểm tra lại định dạng file");
      const token = putImport(parsed);
      ok(res, {
        importToken: token,
        villageName: parsed.villageName,
        villageMaSuggest: parsed.villageMaSuggest,
        to: parsed.to,
        householdCount: parsed.householdCount,
        memberCount: parsed.memberCount,
        warnings: parsed.warnings,
        preview: parsed.households.slice(0, 10).map((h) => ({
          soThanhVien: h.members.length,
          members: h.members.map((m) => ({ hoTen: m.hoTen, ngaySinh: m.ngaySinh, gioiTinh: m.gioiTinh, cccd: m.cccd, quanHeChuHo: m.quanHeChuHo, sdt: m.sdt, laChuHo: m.laChuHo })),
        })),
      }, "Đã phân tích file, xem trước trước khi ghi");
    } catch (e) { fail(res, "Lỗi đọc file: " + e.message, 500); }
  });
});

// POST /api/households/import/commit — ghi kết quả đã xem trước vào DB
router.post(
  "/import/commit",
  requireRole("SUPER_ADMIN", "ADMIN_VILLAGE"),
  [body("importToken").notEmpty().withMessage("Thiếu importToken")],
  validate,
  async (req, res, next) => {
    const { importToken, villageId } = req.body;
    const entry = importCache.get(importToken);
    if (!entry) return fail(res, "Phiên import đã hết hạn, vui lòng tải lại file", 410);
    if (entry.committed) return fail(res, "File này đã được import rồi", 409);
    entry.committed = true; // khóa trước, tránh double-submit
    try {
      const result = await HouseholdService.commitImport(entry.parsed, villageId || null, req.user.id);
      importCache.delete(importToken);
      created(res, result, `Thêm mới ${result.added} · Cập nhật ${result.updated} · Bỏ qua ${result.skipped} (vào ${result.village.ten})`);
    } catch (err) { entry.committed = false; next(err); }
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
