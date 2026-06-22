const router = require("express").Router();
const AdminUserRepo = require("../repositories/pg/AdminUserRepo");
const { authenticate } = require("../middlewares/auth.middleware");

router.use(authenticate);

router.get("/", async (req, res, next) => {
  try {
    const users = await AdminUserRepo.findAll();
    const safeUsers = users.map(({ passwordHash, ...u }) => ({
      id: u.id,
      hoTen: u.hoTen,
      username: u.username,
      role: u.role,
      categoryIds: u.categoryIds || []
    }));
    res.json({ success: true, data: safeUsers });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
