const axios = require("axios").default;
const redis = require("../../config/redis");
const env = require("../../config/env");
const logger = require("../../utils/logger");

// Redis keys
const KEY_ACCESS  = "zalo_oa:access_token";
const KEY_REFRESH = "zalo_oa:refresh_token";

// Access token Zalo OA tồn tại 90 ngày; refresh trước 3 ngày
const TOKEN_TTL_SEC    = 90 * 24 * 60 * 60;       // 7 776 000 s
const REFRESH_BUFFER_S = 3  * 24 * 60 * 60;       // 259 200 s

async function getToken() {
  const token = await redis.get(KEY_ACCESS);
  return token || env.ZALO_OA_ACCESS_TOKEN || null;
}

async function saveTokens(accessToken, refreshToken) {
  await redis.set(KEY_ACCESS, accessToken, { ex: TOKEN_TTL_SEC });
  if (refreshToken) {
    // Refresh token không hết hạn theo Zalo, lưu không TTL
    await redis.set(KEY_REFRESH, refreshToken);
  }
  logger.info("Zalo OA tokens đã được lưu vào Redis");
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
      await saveTokens(data.access_token, data.refresh_token || refreshToken);
      logger.info("Zalo OA access token đã được làm mới thành công");
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
