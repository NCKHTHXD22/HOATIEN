const router = require("express").Router();
const InAppAlert = require("../models/mongo/InAppAlert");
const { authenticate } = require("../middlewares/auth.middleware");

router.use(authenticate);

// Get recent alerts for current user
router.get("/", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    const recipientId = req.user.id.toString();
    const query = { recipientId };
    
    const alerts = await InAppAlert.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
      
    const total = await InAppAlert.countDocuments(query);
    
    res.json({
      success: true,
      data: alerts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Count unread alerts
router.get("/unread-count", async (req, res) => {
  try {
    const count = await InAppAlert.countDocuments({
      recipientId: req.user.id.toString(),
      read: false
    });
    res.json({ success: true, count });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Mark alert as read
router.post("/:id/read", async (req, res) => {
  try {
    const alert = await InAppAlert.findOneAndUpdate(
      { _id: req.params.id, recipientId: req.user.id.toString() },
      { read: true },
      { new: true }
    );
    if (!alert) {
      return res.status(404).json({ success: false, message: "Không tìm thấy thông báo" });
    }
    res.json({ success: true, data: alert });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Mark all as read
router.post("/read-all", async (req, res) => {
  try {
    await InAppAlert.updateMany(
      { recipientId: req.user.id.toString(), read: false },
      { read: true }
    );
    res.json({ success: true, message: "Đã đánh dấu tất cả đã đọc" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
