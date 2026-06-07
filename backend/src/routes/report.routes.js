const router = require("express").Router();
const ReportService = require("../services/ReportService");
const ReportCacheRepo = require("../repositories/mongo/ReportCacheRepo");
const { authenticate, requireRole } = require("../middlewares/auth.middleware");
const { ok } = require("../utils/response");

router.use(authenticate);

// GET /api/reports/summary
router.get("/summary", async (req, res, next) => {
  try { ok(res, await ReportService.getTotalSummary()); } catch (err) { next(err); }
});

// GET /api/reports/by-village
router.get("/by-village", async (req, res, next) => {
  try { ok(res, await ReportService.getStatsByVillage()); } catch (err) { next(err); }
});

// GET /api/reports/movements?fromDate=&toDate=
router.get("/movements", async (req, res, next) => {
  try { ok(res, await ReportService.getMovementStats(req.query)); } catch (err) { next(err); }
});

// DELETE /api/reports/cache  (flush cache — SUPER_ADMIN only)
router.delete("/cache", requireRole("SUPER_ADMIN"), async (req, res, next) => {
  try { await ReportCacheRepo.invalidateAll(); ok(res, null, "Đã xóa toàn bộ report cache"); } catch (err) { next(err); }
});

module.exports = router;
