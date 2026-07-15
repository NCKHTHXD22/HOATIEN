const cron = require("node-cron");
const ZaloConfigRepo = require("../repositories/mongo/ZaloConfigRepo");
const logger = require("../utils/logger");

// Chạy mỗi 6 giờ — kiểm tra và refresh nếu gần hết hạn (token Zalo chỉ sống ~25h)
function startZaloTokenRefreshJob() {
  cron.schedule("0 */6 * * *", async () => {
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

  logger.info("[ZaloTokenRefresh] Đã lên lịch kiểm tra token mỗi 6 giờ");
}

module.exports = { startZaloTokenRefreshJob };
