const router = require("express").Router();
const { body } = require("express-validator");
const AuthService = require("../services/AuthService");
const AdminUserRepo = require("../repositories/pg/AdminUserRepo");
const { authenticate, requireRole } = require("../middlewares/auth.middleware");
const { validate } = require("../middlewares/validate.middleware");
const { ok, created, fail } = require("../utils/response");

// POST /api/auth/login
router.post(
  "/login",
  [body("username").notEmpty(), body("password").notEmpty()],
  validate,
  async (req, res) => {
    try {
      const result = await AuthService.login(req.body.username, req.body.password);
      ok(res, result, "Đăng nhập thành công");
    } catch (err) {
      fail(res, err.message, 401);
    }
  }
);

// GET /api/auth/me
router.get("/me", authenticate, (req, res) => ok(res, req.user));

// POST /api/auth/users  (chỉ SUPER_ADMIN)
router.post(
  "/users",
  authenticate,
  requireRole("SUPER_ADMIN"),
  [
    body("username").notEmpty().isLength({ min: 3 }),
    body("password").notEmpty().isLength({ min: 6 }),
    body("hoTen").notEmpty(),
    body("role").isIn(["SUPER_ADMIN", "ADMIN_VILLAGE", "VIEWER"]),
  ],
  validate,
  async (req, res) => {
    try {
      const user = await AuthService.createUser(req.body);
      created(res, user, "Tạo tài khoản thành công");
    } catch (err) {
      fail(res, err.message);
    }
  }
);

// GET /api/auth/users
router.get("/users", authenticate, requireRole("SUPER_ADMIN"), async (req, res, next) => {
  try {
    const users = await AdminUserRepo.findAll();
    ok(res, users.map(({ passwordHash: _, ...u }) => u));
  } catch (err) { next(err); }
});

// PUT /api/auth/users/:id/notify-permission  (chỉ SUPER_ADMIN)
router.put(
  "/users/:id/notify-permission",
  authenticate,
  requireRole("SUPER_ADMIN"),
  async (req, res, next) => {
    try {
      const { canSendNotification } = req.body;
      if (typeof canSendNotification !== "boolean") {
        return fail(res, "canSendNotification phải là true hoặc false");
      }
      const updated = await AdminUserRepo.update(req.params.id, { canSendNotification });
      const { passwordHash: _, ...safeUser } = updated;
      const msg = canSendNotification ? "Đã cấp quyền gửi thông báo" : "Đã thu hồi quyền gửi thông báo";
      ok(res, safeUser, msg);
    } catch (err) { next(err); }
  }
);

// PUT /api/auth/change-password
router.put(
  "/change-password",
  authenticate,
  [body("oldPassword").notEmpty(), body("newPassword").isLength({ min: 6 })],
  validate,
  async (req, res) => {
    try {
      await AuthService.changePassword(req.user.id, req.body.oldPassword, req.body.newPassword);
      ok(res, null, "Đổi mật khẩu thành công");
    } catch (err) {
      fail(res, err.message);
    }
  }
);

module.exports = router;
