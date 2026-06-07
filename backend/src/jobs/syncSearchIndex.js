const cron = require("node-cron");
const SearchService = require("../services/SearchService");
const logger = require("../utils/logger");

// Chạy lúc 2:00 AM mỗi đêm
function startSyncJob() {
  cron.schedule("0 2 * * *", async () => {
    logger.info("[SyncJob] Starting nightly search index re-sync...");
    try {
      await SearchService.fullResync();
      logger.info("[SyncJob] Nightly re-sync completed");
    } catch (err) {
      logger.error(`[SyncJob] Re-sync failed: ${err.message}`);
    }
  });
  logger.info("[SyncJob] Nightly sync job scheduled at 02:00 AM");
}

module.exports = { startSyncJob };
