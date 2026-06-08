const router = require("express").Router();
const ZaloService = require("../services/ZaloService");
const ZaloConfigRepo = require("../repositories/mongo/ZaloConfigRepo");
const ZaloEvent = require("../models/mongo/ZaloEvent");
const { authenticate, requireRole } = require("../middlewares/auth.middleware");
const { ok, fail } = require("../utils/response");
const logger = require("../utils/logger");

// POST /api/zalo/webhook  — Zalo gọi vào đây
router.post("/webhook", async (req, res) => {
  try {
    const { user_id_by_app, message } = req.body;

    if (!user_id_by_app || !message?.text) {
      return res.status(200).json({ error: 0 });
    }

    ZaloEvent.create({ type: "WEBHOOK", zaloUserId: user_id_by_app, payload: req.body }).catch(() => {});

    const reply = await ZaloService.handleMessage(user_id_by_app, message.text);
    logger.info(`Zalo webhook [${user_id_by_app}]: "${message.text}" → replied`);

    res.status(200).json({ error: 0, message: reply });
  } catch (err) {
    logger.error(`Zalo webhook error: ${err.message}`);
    res.status(200).json({ error: 0 });
  }
});

// GET /api/zalo/webhook — Zalo dùng để verify endpoint
router.get("/webhook", (req, res) => {
  res.status(200).send(req.query["hub.challenge"] || "OK");
});

// POST /api/zalo/tokens — lưu access token + refresh token thủ công (SUPER_ADMIN)
router.post("/tokens", authenticate, requireRole("SUPER_ADMIN"), async (req, res, next) => {
  try {
    const { accessToken, refreshToken } = req.body;
    if (!accessToken) return fail(res, "accessToken là bắt buộc");
    await ZaloConfigRepo.saveTokens(accessToken, refreshToken || null);
    ok(res, null, "Đã lưu Zalo OA tokens thành công");
  } catch (err) { next(err); }
});

// POST /api/zalo/refresh-token — trigger refresh thủ công (SUPER_ADMIN)
router.post("/refresh-token", authenticate, requireRole("SUPER_ADMIN"), async (req, res, next) => {
  try {
    const newToken = await ZaloConfigRepo.refreshAccessToken();
    if (!newToken) return fail(res, "Refresh thất bại — kiểm tra refresh token trong DB");
    ok(res, { accessToken: newToken.slice(0, 20) + "..." }, "Token đã được làm mới");
  } catch (err) { next(err); }
});

// GET /api/zalo/token-status — kiểm tra trạng thái token (SUPER_ADMIN)
router.get("/token-status", authenticate, requireRole("SUPER_ADMIN"), async (req, res, next) => {
  try {
    const ZaloConfig = require("../models/mongo/ZaloConfig");
    const doc = await ZaloConfig.findOne({ key: "oa_token" }).lean();
    if (!doc) return ok(res, { configured: false, message: "Chưa có token nào được lưu" });
    ok(res, {
      configured: !!doc.accessToken,
      hasRefreshToken: !!doc.refreshToken,
      expiresAt: doc.expiresAt,
      daysLeft: doc.expiresAt
        ? Math.max(0, Math.floor((new Date(doc.expiresAt) - Date.now()) / 86400000))
        : null,
      updatedAt: doc.updatedAt,
    });
  } catch (err) { next(err); }
});

// GET /api/zalo/events — xem log sự kiện (admin)
router.get("/events", authenticate, requireRole("SUPER_ADMIN", "ADMIN_VILLAGE"), async (req, res, next) => {
  try {
    const events = await ZaloEvent.find().sort({ timestamp: -1 }).limit(100).lean();
    ok(res, events);
  } catch (err) { next(err); }
});

module.exports = router;
