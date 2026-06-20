const router = require("express").Router();
const axios = require("axios").default;
const ZaloService = require("../services/ZaloService");
const ZaloConfigRepo = require("../repositories/mongo/ZaloConfigRepo");
const ZaloFollowerRepo = require("../repositories/mongo/ZaloFollowerRepo");
const MemberRepo = require("../repositories/pg/MemberRepo");
const ZaloEvent = require("../models/mongo/ZaloEvent");
const { authenticate, requireRole, requireSendPermission } = require("../middlewares/auth.middleware");
const { ok, fail } = require("../utils/response");
const env = require("../config/env");
const logger = require("../utils/logger");

// POST /api/zalo/webhook  — Zalo gọi vào đây
router.post("/webhook", async (req, res) => {
  try {
    const { user_id_by_app, message } = req.body;

    if (!user_id_by_app || !message?.text) {
      return res.status(200).json({ error: 0 });
    }

    // NGUY HIỂM: Phải check event_name để tránh vòng lặp vô tận khi OA gửi tin
    if (req.body.event_name !== "user_send_text") {
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
    const redis = require("../config/redis");
    const accessToken  = await redis.get("zalo_oa:access_token");
    const refreshToken = await redis.get("zalo_oa:refresh_token");
    const ttlSeconds   = await redis.ttl("zalo_oa:access_token");

    if (!accessToken) {
      return ok(res, { configured: false, message: "Chưa có token nào được lưu trong Redis" });
    }

    const daysLeft = ttlSeconds > 0 ? Math.floor(ttlSeconds / 86400) : null;
    ok(res, {
      configured:      true,
      hasRefreshToken: !!refreshToken,
      daysLeft,
      ttlSeconds: ttlSeconds > 0 ? ttlSeconds : null,
    });
  } catch (err) { next(err); }
});

// GET /api/zalo/auth-url — tạo URL để admin cấp quyền OA (SUPER_ADMIN)
router.get("/auth-url", authenticate, requireRole("SUPER_ADMIN"), (req, res) => {
  const redirectUri = encodeURIComponent(`${req.protocol}://${req.get("host")}/api/zalo/callback`);
  const url = `https://oauth.zaloapp.com/v4/oa/permission?app_id=${env.ZALO_APP_ID}&redirect_uri=${redirectUri}`;
  ok(res, { url }, "Mở URL này để cấp quyền cho OA");
});

// GET /api/zalo/callback — Zalo redirect về đây sau khi admin cấp quyền
router.get("/callback", async (req, res) => {
  const { code, oa_access_token, refresh_token } = req.query;

  try {
    // Zalo v4 OA: đôi khi trả thẳng token (không dùng code)
    if (oa_access_token) {
      await ZaloConfigRepo.saveTokens(oa_access_token, refresh_token || null);
      logger.info("Zalo OA callback: token nhận trực tiếp, đã lưu Redis");
      return res.send(`<h2 style="font-family:sans-serif;color:green">✓ Zalo OA đã kết nối thành công!</h2><p>Bạn có thể đóng tab này.</p>`);
    }

    // Đổi authorization code lấy token
    if (!code) {
      return res.status(400).send("<h2 style='color:red'>Thiếu code từ Zalo</h2>");
    }

    const redirectUri = `${req.protocol}://${req.get("host")}/api/zalo/callback`;
    const { data } = await axios.post(
      "https://oauth.zaloapp.com/v4/oa/access_token",
      new URLSearchParams({
        app_id:       env.ZALO_APP_ID,
        grant_type:   "authorization_code",
        code,
        redirect_uri: redirectUri,
      }),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          secret_key: env.ZALO_APP_SECRET,
        },
      }
    );

    if (!data.access_token) {
      logger.error(`Zalo callback lỗi: ${JSON.stringify(data)}`);
      return res.status(400).send(`<h2 style="color:red">Lỗi: ${data.message || "Không nhận được token"}</h2>`);
    }

    await ZaloConfigRepo.saveTokens(data.access_token, data.refresh_token || null);
    logger.info("Zalo OA callback: đã đổi code lấy token thành công");
    res.send(`<h2 style="font-family:sans-serif;color:green">✓ Zalo OA đã kết nối thành công!</h2><p>Bạn có thể đóng tab này.</p>`);
  } catch (err) {
    logger.error(`Zalo callback error: ${err.message}`);
    res.status(500).send(`<h2 style="color:red">Lỗi server: ${err.message}</h2>`);
  }
});

// POST /api/zalo/followers/sync — bắt đầu đồng bộ follower từ OA (chạy nền, admin)
router.post("/followers/sync", authenticate, requireRole("SUPER_ADMIN", "ADMIN_VILLAGE"), async (req, res, next) => {
  try {
    const r = ZaloService.startSyncFollowers();
    if (r.running) return ok(res, r, "Đang đồng bộ rồi, vui lòng đợi...");
    ok(res, r, "Đã bắt đầu đồng bộ (tên cập nhật dần). Xem ở GET /followers.");
  } catch (err) { next(err); }
});

// GET /api/zalo/followers — danh sách follower đã đồng bộ + tiến độ (admin)
router.get("/followers", authenticate, requireRole("SUPER_ADMIN", "ADMIN_VILLAGE"), async (req, res, next) => {
  try {
    const followers = await ZaloFollowerRepo.findAll();
    ok(res, { syncing: ZaloService.isSyncing(), total: followers.length, followers });
  } catch (err) { next(err); }
});

// POST /api/zalo/followers/send — gửi 1 tin tới các follower được chọn (cần quyền gửi)
// Bắt buộc liệt kê userIds rõ ràng — KHÔNG có "gửi tất cả" để tránh bắn nhầm cả OA.
router.post("/followers/send", authenticate, requireSendPermission(), async (req, res, next) => {
  try {
    const { userIds = [], message } = req.body;
    if (!Array.isArray(userIds) || userIds.length === 0) return fail(res, "Cần chọn ít nhất 1 follower (userIds)");
    if (!message || !message.trim()) return fail(res, "Nội dung không được để trống");
    const results = await ZaloService.sendToFollowers(userIds, message.trim());
    const sent = results.filter((r) => r.sent).length;
    ok(res, { sent, failed: results.length - sent, results }, `Đã gửi ${sent}/${results.length}`);
  } catch (err) { next(err); }
});

// POST /api/zalo/followers/:userId/link — liên kết tài khoản Zalo với Nhân khẩu
router.post("/followers/:userId/link", authenticate, requireRole("SUPER_ADMIN", "ADMIN_VILLAGE"), async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { memberId } = req.body; // có thể null để hủy liên kết
    
    const follower = await ZaloFollowerRepo.findByUserId(userId);
    if (!follower) return fail(res, "Không tìm thấy người theo dõi Zalo này");

    // Nếu đã liên kết với ai đó trước đây, xóa liên kết cũ ở Postgres
    if (follower.linkedMemberId) {
      await MemberRepo.update(follower.linkedMemberId, { zaloUserId: null }).catch(() => {});
    }

    // Nếu có memberId mới, set vào Postgres
    if (memberId) {
      const member = await MemberRepo.findById(memberId);
      if (!member) return fail(res, "Không tìm thấy hồ sơ nhân khẩu");
      await MemberRepo.update(memberId, { zaloUserId: userId });
    }

    // Cập nhật Mongo
    await ZaloFollowerRepo.setLink(userId, memberId || null);

    ok(res, null, memberId ? "Đã ghép nối thành công" : "Đã hủy ghép nối thành công");
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
