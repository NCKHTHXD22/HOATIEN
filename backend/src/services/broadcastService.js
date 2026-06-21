// Job gửi broadcast async (port từ QUESON) — gửi follower/nhóm Zalo + ghi log
const zalo = require("../utils/zaloBroadcast");
const BroadcastLog = require("../models/mongo/BroadcastLog");
const logger = require("../utils/logger");

const jobs = new Map();

function createJob(total) {
  const jobId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  jobs.set(jobId, { total, sent: 0, failed: 0, done: false, startedAt: new Date().toISOString() });
  return jobId;
}

function getJob(jobId) {
  return jobs.get(jobId) || null;
}

// userIds: mảng user_id; nhóm thì truyền dạng "g:<groupId>"
// attachments = { attachmentIds: [], videoAttachmentId: null, fileAttachmentId: null }
async function sendToUsers(userIds, message, attachments = {}, adminNote, linkUrl, linkTitle) {
  const { attachmentIds = [], videoAttachmentId = null, fileAttachmentId = null } = attachments;
  const jobId = createJob(userIds.length);
  const job = jobs.get(jobId);

  (async () => {
    for (const rawId of userIds) {
      try {
        const isGroup = rawId.startsWith("g:");
        const id = isGroup ? rawId.slice(2) : rawId;

        let text = message || "";
        if (linkUrl) {
          const line = linkTitle ? `🔗 ${linkTitle}: ${linkUrl}` : `🔗 ${linkUrl}`;
          text = text ? `${text}\n\n${line}` : line;
        }

        if (text) await zalo.sendText(id, text, isGroup);
        if (attachmentIds.length > 0) await zalo.sendImages(id, attachmentIds, isGroup);
        if (videoAttachmentId) await zalo.sendText(id, `📹 Xem video: ${videoAttachmentId}`, isGroup);
        if (fileAttachmentId) await zalo.sendFile(id, fileAttachmentId, isGroup);

        job.sent++;
      } catch (err) {
        logger.error(`[Broadcast] gửi ${rawId} lỗi: ${err.message}`);
        job.failed++;
      }
      await new Promise((r) => setTimeout(r, 500)); // tránh rate limit
    }

    job.done = true;

    let logMsg = message || "";
    if (!logMsg) {
      if (videoAttachmentId) logMsg = "[video]";
      else if (fileAttachmentId) logMsg = "[file]";
      else if (attachmentIds.length > 0) logMsg = `[${attachmentIds.length} ảnh]`;
      else if (linkUrl) logMsg = `[link] ${linkUrl}`;
    }

    await BroadcastLog.create({
      message: logMsg,
      recipientCount: userIds.length,
      sent: job.sent,
      failed: job.failed,
      adminNote: adminNote || "",
    }).catch(() => {});

    setTimeout(() => jobs.delete(jobId), 10 * 60 * 1000);
  })();

  return jobId;
}

module.exports = { sendToUsers, getJob };
