const router = require("express").Router();
const { body } = require("express-validator");
const VillageService = require("../services/VillageService");
const { authenticate, requireRole } = require("../middlewares/auth.middleware");
const { validate } = require("../middlewares/validate.middleware");
const { ok, created } = require("../utils/response");

router.use(authenticate);

router.get("/", async (req, res, next) => {
  try { ok(res, await VillageService.getAll()); } catch (err) { next(err); }
});

router.get("/:id", async (req, res, next) => {
  try { ok(res, await VillageService.getById(req.params.id)); } catch (err) { next(err); }
});

router.post(
  "/",
  requireRole("SUPER_ADMIN"),
  [body("ma").notEmpty(), body("ten").notEmpty()],
  validate,
  async (req, res, next) => {
    try { created(res, await VillageService.create(req.body, req.user.id)); } catch (err) { next(err); }
  }
);

router.put(
  "/:id",
  requireRole("SUPER_ADMIN", "ADMIN_VILLAGE"),
  [body("ten").optional().notEmpty()],
  validate,
  async (req, res, next) => {
    try { ok(res, await VillageService.update(req.params.id, req.body, req.user.id)); } catch (err) { next(err); }
  }
);

router.delete("/:id", requireRole("SUPER_ADMIN"), async (req, res, next) => {
  try { await VillageService.remove(req.params.id, req.user.id); ok(res, null, "Đã xóa thôn"); } catch (err) { next(err); }
});

module.exports = router;
