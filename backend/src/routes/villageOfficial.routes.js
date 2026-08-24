const router = require("express").Router();
const { body } = require("express-validator");
const VillageOfficialService = require("../services/VillageOfficialService");
const { authenticate, requireRole } = require("../middlewares/auth.middleware");
const { validate } = require("../middlewares/validate.middleware");
const { ok, created } = require("../utils/response");

router.use(authenticate);

router.get("/", async (req, res, next) => {
  try { ok(res, await VillageOfficialService.getAll(req.query)); } catch (err) { next(err); }
});

router.get("/:id", async (req, res, next) => {
  try { ok(res, await VillageOfficialService.getById(req.params.id)); } catch (err) { next(err); }
});

router.post(
  "/",
  requireRole("SUPER_ADMIN", "ADMIN_VILLAGE"),
  [body("villageId").notEmpty(), body("hoTen").notEmpty(), body("chucDanh").notEmpty()],
  validate,
  async (req, res, next) => {
    try { created(res, await VillageOfficialService.create(req.body, req.user.id)); } catch (err) { next(err); }
  }
);

router.put(
  "/:id",
  requireRole("SUPER_ADMIN", "ADMIN_VILLAGE"),
  [body("hoTen").optional().notEmpty(), body("chucDanh").optional().notEmpty()],
  validate,
  async (req, res, next) => {
    try { ok(res, await VillageOfficialService.update(req.params.id, req.body, req.user.id)); } catch (err) { next(err); }
  }
);

router.delete("/:id", requireRole("SUPER_ADMIN", "ADMIN_VILLAGE"), async (req, res, next) => {
  try { await VillageOfficialService.remove(req.params.id, req.user.id); ok(res, null, "Đã xóa cán bộ thôn"); } catch (err) { next(err); }
});

module.exports = router;
