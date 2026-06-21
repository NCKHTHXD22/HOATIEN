const cron = require("node-cron");
const ScheduledBroadcast = require("../models/mongo/ScheduledBroadcast");
const { sendToUsers, getJob } = require("../services/broadcastService");
const logger = require("../utils/logger");

function _waitJob(jobId, timeoutMs) {
  return new Promise((resolve) => {
    const start = Date.now();
    const iv = setInterval(() => {
      const job = getJob(jobId);
      if (!job || job.done || Date.now() - start > timeoutMs) {
        clearInterval(iv);
        resolve(job || { sent: 0, failed: 0 });
      }
    }, 1000);
  });
}

// Mỗi phút: quét lịch broadcast đến giờ và gửi
function startScheduledBroadcastJob() {
  cron.schedule("* * * * *", async () => {
    try {
      const due = await ScheduledBroadcast.find({ status: "pending", scheduledAt: { $lte: new Date() } });
      for (const d of due) {
        d.status = "sending";
        await d.save();
        const recipients = [...(d.userIds || []), ...(d.groupIds || []).map((g) => `g:${g}`)];
        try {
          const jobId = await sendToUsers(recipients, d.message, {
            attachmentIds: d.attachmentIds || [],
            videoAttachmentId: d.videoAttachmentId,
            fileAttachmentId: d.fileAttachmentId,
          }, d.adminNote, d.linkUrl, d.linkTitle);
          const result = await _waitJob(jobId, 10 * 60 * 1000);
          d.status = "done"; d.sent = result.sent; d.failed = result.failed;
          await d.save();
          logger.info(`[ScheduledBroadcast] ${d._id} done: ${result.sent}/${recipients.length}`);
        } catch (e) {
          d.status = "failed";
          await d.save();
          logger.error(`[ScheduledBroadcast] ${d._id} failed: ${e.message}`);
        }
      }
    } catch (err) {
      logger.error(`[ScheduledBroadcast] job error: ${err.message}`);
    }
  });
  logger.info("[ScheduledBroadcast] job scheduled (every minute)");
}

module.exports = { startScheduledBroadcastJob };
