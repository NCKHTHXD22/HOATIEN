const axios = require("axios").default;
const redis = require("../../config/redis");
const env = require("../../config/env");
const logger = require("../../utils/logger");

// Redis keys
const KEY_ACCESS  = "zalo_oa:access_token";
const KEY_REFRESH = "zalo_oa:refresh_token";

// ⚠️ Access token Zalo OA THẬT chỉ sống ~25h (expires_in ≈ 90000s), KHÔNG phải 90 ngày.
// TTL Redis phải khớp expires_in thật thì needsRefresh mới đúng → mới tự gia hạn kịp.
const DEFAULT_TOKEN_TTL_SEC = 90000;              // ~25h — dùng khi Zalo không trả expires_in
const REFRESH_BUFFER_S      = 6 * 60 * 60;        // gia hạn sớm khi còn < 6h

async function getToken() {
  const token = await redis.get(KEY_ACCESS);
  return token || env.ZALO_OA_ACCESS_TOKEN || null;
}

async function saveTokens(accessToken, refreshToken, expiresIn) {
  const ttl = Number(expiresIn) > 0 ? Number(expiresIn) : DEFAULT_TOKEN_TTL_SEC;
  await redis.set(KEY_ACCESS, accessToken, { ex: ttl });
  if (refreshToken) {
    // Refresh token dài hạn (Zalo ~3 tháng, xoay vòng mỗi lần refresh) — lưu không TTL
    await redis.set(KEY_REFRESH, refreshToken);
  }
  logger.info(`Zalo OA tokens đã lưu vào Redis (access TTL ${ttl}s ≈ ${(ttl / 3600).toFixed(1)}h)`);
}

// Khởi tạo lần đầu từ .env nếu Redis chưa có
async function initFromEnv() {
  const existing = await redis.get(KEY_ACCESS);
  if (!existing && env.ZALO_OA_ACCESS_TOKEN) {
    await saveTokens(env.ZALO_OA_ACCESS_TOKEN, env.ZALO_OA_REFRESH_TOKEN || null);
    logger.info("Zalo OA tokens đã được khởi tạo từ .env vào Redis");
  }
}

async function needsRefresh() {
  // Kiểm tra TTL còn lại của access token trong Redis
  const ttl = await redis.ttl(KEY_ACCESS);
  // ttl = -2 (key không tồn tại), -1 (không có TTL), hoặc số giây còn lại
  if (ttl < 0) return false;
  return ttl < REFRESH_BUFFER_S;
}

async function refreshAccessToken() {
  const refreshToken =
    (await redis.get(KEY_REFRESH)) || env.ZALO_OA_REFRESH_TOKEN;

  if (!refreshToken) {
    logger.warn("Zalo: không có refresh token — không thể tự làm mới");
    return null;
  }

  try {
    const { data } = await axios.post(
      "https://oauth.zaloapp.com/v4/oa/access_token",
      new URLSearchParams({
        app_id:        env.ZALO_APP_ID,
        grant_type:    "refresh_token",
        refresh_token: refreshToken,
      }),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          secret_key: env.ZALO_APP_SECRET,
        },
      }
    );

    if (data.access_token) {
      await saveTokens(data.access_token, data.refresh_token || refreshToken, data.expires_in);
      logger.info(`Zalo OA access token đã được làm mới (hết hạn sau ~${((data.expires_in || DEFAULT_TOKEN_TTL_SEC) / 3600).toFixed(1)}h)`);
      return data.access_token;
    }

    logger.error(`Zalo refresh failed: ${JSON.stringify(data)}`);
    return null;
  } catch (err) {
    logger.error(`Zalo refresh error: ${err.message}`);
    return null;
  }
}

// Lấy token hợp lệ — tự refresh nếu gần hết hạn
async function getValidToken() {
  if (await needsRefresh()) {
    const newToken = await refreshAccessToken();
    if (newToken) return newToken;
  }
  return getToken();
}

module.exports = { getToken, saveTokens, initFromEnv, needsRefresh, refreshAccessToken, getValidToken };
