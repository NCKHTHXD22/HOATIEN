const router = require("express").Router();
const Category = require("../models/mongo/Category");
const ZaloGroupMember = require("../models/mongo/ZaloGroupMember");
const zaloGmf = require("../utils/zaloGmf");
const { authenticate, requireRole } = require("../middlewares/auth.middleware");

router.use(authenticate);

// GET /api/categories — danh sách lĩnh vực (mọi admin xem được để lọc)
router.get("/", async (req, res, next) => {
  try {
    const categories = await Category.find({}).sort({ order: 1 }).lean();
    res.json({ categories });
  } catch (err) { next(err); }
});

// POST /api/categories — liên kết nhóm có sẵn (SUPER_ADMIN)
router.post("/", requireRole("SUPER_ADMIN"), async (req, res, next) => {
  try {
    const { name, zaloGroupId, icon, order } = req.body;
    if (!name) return res.status(400).json({ error: "Thiếu tên lĩnh vực" });
    const cat = await Category.create({ name, zaloGroupId: zaloGroupId || "", icon: icon || "📋", order: order ?? 0 });
    res.status(201).json({ category: cat });
  } catch (err) { next(err); }
});

// POST /api/categories/create-zalo-group — tạo nhóm Zalo (GMF) rồi lưu Category (SUPER_ADMIN)
router.post("/create-zalo-group", requireRole("SUPER_ADMIN"), async (req, res, next) => {
  try {
    const { name, icon, order, members } = req.body;
    if (!name || !members?.length) return res.status(400).json({ error: "Thiếu tên hoặc thành viên ban đầu" });
    const memberIds = members.map((m) => m.userId || m.zaloUserId).filter(Boolean);
    const zaloGroupId = await zaloGmf.createZaloGroup(name, memberIds, name);
    const cat = await Category.create({ name, zaloGroupId: String(zaloGroupId), icon: icon || "📋", order: order ?? 0 });
    for (const m of members) {
      const uid = m.userId || m.zaloUserId;
      if (!uid) continue;
      await ZaloGroupMember.findOneAndUpdate(
        { groupId: String(zaloGroupId), zaloUserId: String(uid) },
        { $set: { displayName: m.displayName || "", avatar: m.avatar || "" } },
        { upsert: true }
      ).catch(() => {});
    }
    res.status(201).json({ category: cat });
  } catch (err) { next(err); }
});

// PUT /api/categories/:id (SUPER_ADMIN)
router.put("/:id", requireRole("SUPER_ADMIN"), async (req, res, next) => {
  try {
    const { name, zaloGroupId, icon, order } = req.body;
    await Category.findByIdAndUpdate(req.params.id, { name, zaloGroupId, icon, order });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// DELETE /api/categories/:id — xoá lĩnh vực + thành viên (SUPER_ADMIN). KHÔNG tự giải tán nhóm Zalo thật.
router.delete("/:id", requireRole("SUPER_ADMIN"), async (req, res, next) => {
  try {
    const cat = await Category.findById(req.params.id);
    if (!cat) return res.status(404).json({ error: "Không tìm thấy lĩnh vực" });
    if (cat.zaloGroupId) await ZaloGroupMember.deleteMany({ groupId: cat.zaloGroupId });
    await Category.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
