const router = require("express").Router();
const { body } = require("express-validator");
const MemberService = require("../services/MemberService");
const { authenticate, requireRole } = require("../middlewares/auth.middleware");
const { validate } = require("../middlewares/validate.middleware");
const { ok, created } = require("../utils/response");

router.use(authenticate);

// GET /api/members/household/:householdId
router.get("/household/:householdId", async (req, res, next) => {
  try { ok(res, await MemberService.getByHousehold(req.params.householdId)); } catch (err) { next(err); }
});

// GET /api/members/search?q=query
router.get("/search", async (req, res, next) => {
  try {
    const q = req.query.q || "";
    if (!q) return ok(res, []);
    const { prisma } = require("../config/database");
    
    const members = await prisma.member.findMany({
      where: {
        OR: [
          { hoTen: { contains: q, mode: "insensitive" } },
          { sdt: { contains: q } },
        ]
      },
      take: 20,
      include: {
        household: {
          include: { village: true }
        }
      }
    });
    ok(res, members);
  } catch (err) { next(err); }
});

// GET /api/members/:id
router.get("/:id", async (req, res, next) => {
  try { ok(res, await MemberService.getById(req.params.id)); } catch (err) { next(err); }
});

// POST /api/members
router.post(
  "/",
  requireRole("SUPER_ADMIN", "ADMIN_VILLAGE"),
  [
    body("hoTen").notEmpty(),
    body("gioiTinh").isIn(["NAM", "NU", "KHAC"]),
    body("quanHeChuHo").custom((value, { req }) => {
      if (!req.body.laChuHo && !String(value || "").trim()) {
        throw new Error("quanHeChuHo là bắt buộc");
      }
      return true;
    }),
    body("householdId").notEmpty(),
  ],
  validate,
  async (req, res, next) => {
    try { created(res, await MemberService.create(req.body, req.user.id), "Thêm thành viên thành công"); } catch (err) { next(err); }
  }
);

// PUT /api/members/:id
router.put("/:id", requireRole("SUPER_ADMIN", "ADMIN_VILLAGE"), async (req, res, next) => {
  try { ok(res, await MemberService.update(req.params.id, req.body, req.user.id)); } catch (err) { next(err); }
});

// DELETE /api/members/:id
router.delete("/:id", requireRole("SUPER_ADMIN", "ADMIN_VILLAGE"), async (req, res, next) => {
  try { await MemberService.remove(req.params.id, req.user.id); ok(res, null, "Đã xóa thành viên"); } catch (err) { next(err); }
});

module.exports = router;
