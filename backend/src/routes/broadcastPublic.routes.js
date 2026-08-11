// Route công khai (KHÔNG auth) — đếm view broadcast rồi redirect.
// Mount ở /broadcast TRƯỚC router /broadcast có auth: chỉ /click/:id khớp ở đây, còn lại rơi xuống router có auth.
const router = require("express").Router();
const Broadcast = require("../models/mongo/Broadcast");

// GET /api/broadcast/click/:id?to=<url>
router.get("/click/:id", async (req, res) => {
  const { to } = req.query;
  Broadcast.updateOne({ _id: req.params.id }, { $inc: { views: 1 } }).catch(() => {});
  if (to && /^https?:\/\//i.test(to)) return res.redirect(302, to); // validate tránh open-redirect
  res.status(400).send("Link không hợp lệ");
});

module.exports = router;
