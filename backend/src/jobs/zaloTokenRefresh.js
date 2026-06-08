const cron = require("node-cron");
const ZaloConfigRepo = require("../repositories/mongo/ZaloConfigRepo");
const logger = require("../utils/logger");

// Chạy mỗi ngày lúc 03:00 AM — kiểm tra và refresh nếu gần hết hạn
function startZaloTokenRefreshJob() {
  cron.schedule("0 3 * * *", async () => {
    logger.info("[ZaloTokenRefresh] Đang kiểm tra token...");
    try {
      const needs = await ZaloConfigRepo.needsRefresh();
      if (needs) {
        const newToken = await ZaloConfigRepo.refreshAccessToken();
        if (newToken) {
          logger.info("[ZaloTokenRefresh] Token đã được làm mới thành công");
        } else {
          logger.warn("[ZaloTokenRefresh] Làm mới token thất bại — cần can thiệp thủ công");
        }
      } else {
        logger.info("[ZaloTokenRefresh] Token vẫn còn hạn, bỏ qua");
      }
    } catch (err) {
      logger.error(`[ZaloTokenRefresh] Lỗi: ${err.message}`);
    }
  });

  logger.info("[ZaloTokenRefresh] Đã lên lịch kiểm tra token lúc 03:00 AM hàng ngày");
}

module.exports = { startZaloTokenRefreshJob };
