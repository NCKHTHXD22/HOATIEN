const axios = require("axios").default;
const ZaloConfig = require("../../models/mongo/ZaloConfig");
const env = require("../../config/env");
const logger = require("../../utils/logger");

const KEY = "oa_token";
// Refresh trước khi hết hạn 3 ngày
const REFRESH_BUFFER_MS = 3 * 24 * 60 * 60 * 1000;
// Access token Zalo OA tồn tại 90 ngày
const TOKEN_TTL_MS = 90 * 24 * 60 * 60 * 1000;

async function getToken() {
  const doc = await ZaloConfig.findOne({ key: KEY }).lean();
  return doc?.accessToken || env.ZALO_OA_ACCESS_TOKEN || null;
}

async function saveTokens(accessToken, refreshToken) {
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);
  await ZaloConfig.findOneAndUpdate(
    { key: KEY },
    { accessToken, refreshToken, expiresAt, updatedAt: new Date() },
    { upsert: true, new: true }
  );
  logger.info("Zalo OA tokens đã được cập nhật vào MongoDB");
}

// Khởi tạo lần đầu từ .env nếu MongoDB chưa có
async function initFromEnv() {
  const existing = await ZaloConfig.findOne({ key: KEY }).lean();
  if (!existing?.accessToken && env.ZALO_OA_ACCESS_TOKEN) {
    await saveTokens(env.ZALO_OA_ACCESS_TOKEN, env.ZALO_OA_REFRESH_TOKEN || null);
    logger.info("Zalo OA tokens đã được khởi tạo từ .env");
  }
}

async function needsRefresh() {
  const doc = await ZaloConfig.findOne({ key: KEY }).lean();
  if (!doc?.expiresAt) return false;
  return new Date(doc.expiresAt).getTime() - Date.now() < REFRESH_BUFFER_MS;
}

async function refreshAccessToken() {
  const doc = await ZaloConfig.findOne({ key: KEY }).lean();
  const refreshToken = doc?.refreshToken || env.ZALO_OA_REFRESH_TOKEN;

  if (!refreshToken) {
    logger.warn("Zalo: không có refresh token — không thể tự làm mới");
    return null;
  }

  try {
    const { data } = await axios.post(
      "https://oauth.zaloapp.com/v4/oa/access_token",
      new URLSearchParams({
        app_id: env.ZALO_APP_ID,
        grant_type: "refresh_token",
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
