const router = require("express").Router();
const crypto = require("crypto");
const ZaloService = require("../services/ZaloService");
const ZaloEvent = require("../models/mongo/ZaloEvent");
const { authenticate, requireRole } = require("../middlewares/auth.middleware");
const { ok, fail } = require("../utils/response");
const env = require("../config/env");
const logger = require("../utils/logger");

// POST /api/zalo/webhook  — Zalo gọi vào đây
router.post("/webhook", async (req, res) => {
  try {
    const { app_id, user_id_by_app, message } = req.body;

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

// GET /api/zalo/events — xem log sự kiện (admin)
router.get("/events", authenticate, requireRole("SUPER_ADMIN", "ADMIN_VILLAGE"), async (req, res, next) => {
  try {
    const events = await ZaloEvent.find().sort({ timestamp: -1 }).limit(100).lean();
    ok(res, events);
  } catch (err) { next(err); }
});

module.exports = router;
