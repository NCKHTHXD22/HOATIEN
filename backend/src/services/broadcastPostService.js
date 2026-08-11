// Gửi broadcast "Nội dung" (job async) — gửi follower + nhóm Zalo (message/cs), ghi Broadcast + đếm view qua link
const zalo = require("../utils/zaloBroadcast");
const Broadcast = require("../models/mongo/Broadcast");
const logger = require("../utils/logger");
const env = require("../config/env");

const PUBLIC_BASE = (env.CORS_ORIGINS || []).join(",").includes("dxvtech") ? "https://api.dxvtech.vn" : "https://api.dxvtech.vn";

const jobs = new Map();
function createJob(total) {
  const jobId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  jobs.set(jobId, { total, sent: 0, failed: 0, done: false, broadcastId: null, startedAt: new Date().toISOString() });
  return jobId;
}
function getJob(jobId) { return jobs.get(jobId) || null; }

// userIds: follower; groupIds: nhóm Zalo (gửi 1 tin vào nhóm). Quy ước "g:<id>" khớp broadcastService.
async function sendBroadcastPost({ name, content, thumbnail, imageAttachmentId, linkUrl, linkTitle, userIds = [], groupIds = [], createdBy }) {
  const recipients = [...userIds.map(String), ...groupIds.map((g) => "g:" + String(g))];

  const doc = await Broadcast.create({
    name: name || "", content: content || "", thumbnail: thumbnail || "", imageAttachmentId: imageAttachmentId || null,
    linkUrl: linkUrl || "", linkTitle: linkTitle || "", recipientCount: recipients.length,
    userIds: userIds.map(String), groupIds: groupIds.map(String), createdBy: createdBy || "", status: "sending",
  });

  const jobId = createJob(recipients.length);
  const job = jobs.get(jobId);
  job.broadcastId = String(doc._id);

  (async () => {
    // Nội dung + link đã bọc theo dõi (bấm vào tăng views rồi redirect)
    let linkLine = "";
    if (linkUrl) {
      const tracked = `${PUBLIC_BASE}/api/broadcast/click/${doc._id}?to=${encodeURIComponent(linkUrl)}`;
      linkLine = linkTitle ? `🔗 ${linkTitle}: ${tracked}` : `🔗 ${tracked}`;
    }
    const text = [content || "", linkLine].filter(Boolean).join("\n\n");

    for (const rawId of recipients) {
      try {
        const isGroup = rawId.startsWith("g:");
        const id = isGroup ? rawId.slice(2) : rawId;
        if (text) await zalo.sendText(id, text, isGroup);
        if (imageAttachmentId) await zalo.sendImages(id, [imageAttachmentId], isGroup);
        job.sent++;
      } catch (e) {
        logger.error(`[BroadcastPost] gửi ${rawId} lỗi: ${e.message}`);
        job.failed++;
      }
      await new Promise((r) => setTimeout(r, 500)); // tránh rate limit
    }

    job.done = true;
    await Broadcast.findByIdAndUpdate(doc._id, {
      sent: job.sent, failed: job.failed, status: job.sent > 0 ? "success" : "failed",
    }).catch(() => {});
    setTimeout(() => jobs.delete(jobId), 10 * 60 * 1000);
  })();

  return { jobId, broadcastId: String(doc._id) };
}

module.exports = { sendBroadcastPost, getJob };
