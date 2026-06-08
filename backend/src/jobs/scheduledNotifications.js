const cron = require("node-cron");
const NotificationRepo = require("../repositories/pg/NotificationRepo");
const NotificationService = require("../services/NotificationService");
const logger = require("../utils/logger");

function startScheduledNotificationsJob() {
  // Chạy mỗi phút: kiểm tra thông báo đến lịch gửi
  cron.schedule("* * * * *", async () => {
    try {
      const pending = await NotificationRepo.findScheduledReady();
      if (pending.length === 0) return;

      logger.info(`Scheduled notifications: found ${pending.length} ready to send`);

      for (const notif of pending) {
        try {
          await NotificationService.execute(notif.id);
          logger.info(`Scheduled notification sent: ${notif.id} "${notif.tieuDe}"`);
        } catch (err) {
          logger.error(`Scheduled notification FAILED ${notif.id}: ${err.message}`);
        }
      }
    } catch (err) {
      logger.error(`Scheduled notifications job error: ${err.message}`);
    }
  });

  logger.info("Scheduled notifications job started (every minute)");
}

module.exports = { startScheduledNotificationsJob };
