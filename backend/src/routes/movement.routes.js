const router = require("express").Router();
const { body } = require("express-validator");
const MovementService = require("../services/MovementService");
const { authenticate, requireRole } = require("../middlewares/auth.middleware");
const { validate } = require("../middlewares/validate.middleware");
const { ok, created, paginated } = require("../utils/response");

router.use(authenticate);

// GET /api/movements?householdId=&loai=&fromDate=&toDate=&page=&limit=
router.get("/", async (req, res, next) => {
  try {
    const { householdId, loai, fromDate, toDate, page = 1, limit = 20 } = req.query;
    const { data, total } = await MovementService.getAll({ householdId, loai, fromDate, toDate, page, limit });
    paginated(res, data, total, page, limit);
  } catch (err) { next(err); }
});

// POST /api/movements
router.post(
  "/",
  requireRole("SUPER_ADMIN", "ADMIN_VILLAGE"),
  [
    body("householdId").notEmpty(),
    body("loai").isIn(["MOVE_IN", "MOVE_OUT"]),
    body("ngay").isISO8601(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const record = await MovementService.create(req.body, req.user.id);
      created(res, record, "Ghi nhận biến động thành công");
    } catch (err) { next(err); }
  }
);

module.exports = router;
