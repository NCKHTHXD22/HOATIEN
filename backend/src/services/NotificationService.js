const { prisma } = require("../config/database");
const NotificationRepo = require("../repositories/pg/NotificationRepo");
const EmailService = require("./EmailService");
const ZaloService = require("./ZaloService");
const env = require("../config/env");
const logger = require("../utils/logger");

// Mở rộng danh sách người nhận từ recipients (cá nhân + nhóm) → unique members
async function expandRecipients(notificationId) {
  const recipients = await prisma.notificationRecipient.findMany({
    where: { notificationId },
    include: {
      member: true,
      group: {
        include: { members: { include: { member: true } } },
      },
    },
  });

  const memberMap = new Map();
  for (const r of recipients) {
    if (r.member) {
      memberMap.set(r.member.id, r.member);
    }
    if (r.group) {
      for (const gm of r.group.members) {
        memberMap.set(gm.member.id, gm.member);
      }
    }
  }
  return [...memberMap.values()];
}

// Gửi thông báo (gọi từ route "gửi ngay" hoặc cron "lên lịch")
async function execute(notificationId) {
  const notif = await NotificationRepo.findById(notificationId);
  if (!notif) throw new Error("Không tìm thấy thông báo");
  if (!["NHAP", "CHO_GUI"].includes(notif.trangThai)) {
    throw new Error("Thông báo không ở trạng thái có thể gửi");
  }

  await NotificationRepo.update(notificationId, { trangThai: "DANG_GUI" });

  try {
    const members = await expandRecipients(notificationId);
    const channels = notif.kenhGui;

    // Tạo NotificationSend records cho từng (member × kênh) hợp lệ
    const sendRecords = [];
    for (const member of members) {
      for (const kenh of channels) {
        if (kenh === "EMAIL" && !member.email) continue;
        if (kenh === "ZALO" && !member.zaloUserId) continue;
        if (kenh === "SMS" && !member.sdt) continue;
        sendRecords.push({ notificationId, memberId: member.id, kenh });
      }
    }

    if (sendRecords.length === 0) {
      await NotificationRepo.update(notificationId, {
        trangThai: "DA_GUI",
        sentAt: new Date(),
      });
      logger.warn(`Notification ${notificationId}: 0 sends (no valid contact info)`);
      return;
    }

    await NotificationRepo.createSends(sendRecords);

    // Gửi thực tế từng send record
    const sends = await NotificationRepo.findSends(notificationId);
    for (const send of sends) {
      if (send.trangThai !== "PENDING") continue;
      try {
        await _sendByChannel(send.member, send.kenh, notif);
        await NotificationRepo.updateSend(send.id, {
          trangThai: "SENT",
          sentAt: new Date(),
          errorMsg: null,
        });
      } catch (err) {
        logger.error(`Send FAILED [${send.kenh}→${send.member.hoTen}]: ${err.message}`);
        await NotificationRepo.updateSend(send.id, {
          trangThai: "FAILED",
          errorMsg: err.message.substring(0, 200),
        });
      }
    }

    await NotificationRepo.update(notificationId, {
      trangThai: "DA_GUI",
      sentAt: new Date(),
    });
  } catch (err) {
    // Rollback về NHAP nếu lỗi hệ thống (không phải lỗi từng send)
    await NotificationRepo.update(notificationId, { trangThai: "NHAP" });
    throw err;
  }
}

async function _sendByChannel(member, kenh, notif) {
  if (kenh === "ZALO") {
    const text = `📢 ${notif.tieuDe}\n\n${notif.noiDung}`;
    await ZaloService.sendMessage(member.zaloUserId, text, notif.attachments);
  } else if (kenh === "EMAIL") {
    await EmailService.sendEmail({
      to: member.email,
      subject: `[UBND Xã Hòa Tiến] ${notif.tieuDe}`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:auto">
          <h2 style="color:#1d4ed8">${notif.tieuDe}</h2>
          <p>${notif.noiDung.replace(/\n/g, "<br>")}</p>
          <hr>
          <p style="color:#6b7280;font-size:12px">
            UBND Xã Hòa Tiến — Email tự động, vui lòng không phản hồi trực tiếp.
          </p>
        </div>
      `,
    });
  } else if (kenh === "SMS") {
    await _sendSms(member.sdt, `[HOATIEN] ${notif.tieuDe}: ${notif.noiDung}`.substring(0, 160));
  }
}

async function _sendSms(sdt, content) {
  if (!env.ESMS_API_KEY) throw new Error("SMS chưa được cấu hình (ESMS_API_KEY)");
  const axios = require("axios").default;
  const res = await axios.post(
    "https://rest.esms.vn/MainService.svc/json/SendMultipleMessage_V4_post_json/",
    {
      ApiKey: env.ESMS_API_KEY,
      SecretKey: env.ESMS_SECRET_KEY,
      SmsType: 2,
      Brandname: env.ESMS_BRANDNAME,
      Content: content,
      Phone: sdt,
    }
  );
  if (res.data.CodeResult !== "100") {
    throw new Error(`ESMS: ${res.data.ErrorMessage || "Gửi thất bại"}`);
  }
}

// ── Báo cáo hiệu quả gửi tin & tiếp cận (UC14) ─────────────
async function getComprehensiveReportStats(days = 30, source = "ALL") {
  const Broadcast = require("../models/mongo/Broadcast");
  const BroadcastLog = require("../models/mongo/BroadcastLog");

  const since = new Date(Date.now() - (parseInt(days) || 30) * 24 * 60 * 60 * 1000);

  let totalNotifs = 0;
  let sentCount = 0;
  let failedCount = 0;
  let readCount = 0;
  let confirmedCount = 0;
  let pendingCount = 0;

  const channelMap = { ZALO: 0, EMAIL: 0, SMS: 0 };
  let surveyStats = { totalSurveys: 0, totalResponses: 0, responseRate: 0, list: [] };
  let campaignList = [];

  // 1. PostgreSQL Data
  if (["ALL", "ADMIN_NOTIF", "ZALO"].includes(source)) {
    if (["ALL", "ADMIN_NOTIF"].includes(source)) {
      totalNotifs += await prisma.notification.count({
        where: { trangThai: "DA_GUI", sentAt: { gte: since } },
      });
    }

    const sendWhere = { createdAt: { gte: since } };
    if (source === "ZALO") sendWhere.kenh = "ZALO";

    const [sendGroups, channelGroups] = await Promise.all([
      prisma.notificationSend.groupBy({
        by: ["trangThai"],
        _count: { _all: true },
        where: sendWhere,
      }),
      prisma.notificationSend.groupBy({
        by: ["kenh"],
        _count: { _all: true },
        where: sendWhere,
      }),
    ]);

    sendGroups.forEach((g) => {
      if (g.trangThai === "SENT") sentCount += g._count._all;
      else if (g.trangThai === "FAILED") failedCount += g._count._all;
      else if (g.trangThai === "READ") readCount += g._count._all;
      else if (g.trangThai === "CONFIRMED") confirmedCount += g._count._all;
      else if (g.trangThai === "PENDING") pendingCount += g._count._all;
    });

    channelGroups.forEach((g) => {
      channelMap[g.kenh] = (channelMap[g.kenh] || 0) + g._count._all;
    });

    if (["ALL", "ADMIN_NOTIF"].includes(source)) {
      const recentNotifs = await prisma.notification.findMany({
        where: { trangThai: "DA_GUI", sentAt: { gte: since } },
        select: {
          id: true, tieuDe: true, sentAt: true, kenhGui: true,
          admin: { select: { hoTen: true } },
          _count: { select: { sends: true } },
        },
        orderBy: { sentAt: "desc" },
        take: 10,
      });

      recentNotifs.forEach((n) => {
        campaignList.push({
          id: n.id,
          tieuDe: n.tieuDe,
          loai: "Thông báo hành chính",
          kenh: n.kenhGui.join(", "),
          nguoiTao: n.admin?.hoTen || "Hệ thống",
          ngayGui: n.sentAt,
          luotGui: n._count.sends,
        });
      });
    }
  }

  // 2. Surveys Data (Postgres)
  if (["ALL", "SURVEY"].includes(source)) {
    const [totalSurveys, totalResponses, surveys] = await Promise.all([
      prisma.survey.count({ where: { createdAt: { gte: since } } }),
      prisma.surveyResponse.count({ where: { createdAt: { gte: since } } }),
      prisma.survey.findMany({
        where: { createdAt: { gte: since } },
        include: { _count: { select: { responses: true } }, questions: true },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
    ]);

    if (source === "SURVEY") {
      totalNotifs = totalSurveys;
    } else {
      totalNotifs += totalSurveys;
    }

    const calculatedRate = totalSurveys > 0 ? Math.round((totalResponses / (totalSurveys * 10)) * 100) : 0;
    surveyStats = {
      totalSurveys,
      totalResponses,
      responseRate: Math.min(100, calculatedRate),
      list: surveys.map((s) => ({
        id: s.id,
        tieuDe: s.tieuDe,
        active: s.isActive,
        cauHoiCount: s.questions?.length || 0,
        responseCount: s._count.responses,
        createdAt: s.createdAt,
      })),
    };
  }

  // 3. Mongo BroadcastLog (Gửi tin Zalo)
  if (["ALL", "ZALO"].includes(source)) {
    try {
      const logs = await BroadcastLog.find({ timestamp: { $gte: since } }).lean();
      if (source === "ZALO") {
        totalNotifs += logs.length;
      }
      logs.forEach((log) => {
        const sent = log.sent || 0;
        const failed = log.failed || 0;
        sentCount += sent;
        failedCount += failed;
        channelMap.ZALO = (channelMap.ZALO || 0) + (log.recipientCount || (sent + failed));

        campaignList.push({
          id: log._id.toString(),
          tieuDe: log.message?.substring(0, 60) || "Gửi tin Zalo hàng loạt",
          loai: "Gửi tin Zalo",
          kenh: "ZALO",
          nguoiTao: "Admin Zalo",
          ngayGui: log.timestamp,
          luotGui: log.recipientCount || (sent + failed),
        });
      });
    } catch (e) {
      logger.warn(`Failed to aggregate BroadcastLog stats: ${e.message}`);
    }
  }

  // 4. Mongo Broadcast (Nội dung)
  if (["ALL", "CONTENT"].includes(source)) {
    try {
      const broadcasts = await Broadcast.find({ publishedAt: { $gte: since } }).lean();
      if (source === "CONTENT") {
        totalNotifs = broadcasts.length;
        sentCount = 0;
        failedCount = 0;
        readCount = 0;
      } else {
        totalNotifs += broadcasts.length;
      }

      broadcasts.forEach((b) => {
        const sent = b.sent || 0;
        const failed = b.failed || 0;
        const views = b.views || 0;

        sentCount += sent;
        failedCount += failed;
        readCount += views;
        channelMap.ZALO = (channelMap.ZALO || 0) + (b.recipientCount || (sent + failed));

        campaignList.push({
          id: b._id.toString(),
          tieuDe: b.name || b.content?.substring(0, 60) || "Bài viết nội dung",
          loai: "Nội dung",
          kenh: "ZALO OA",
          nguoiTao: b.createdBy || "Quản trị viên",
          ngayGui: b.publishedAt,
          luotGui: b.recipientCount || (sent + failed),
          views: views,
        });
      });
    } catch (e) {
      logger.warn(`Failed to aggregate Broadcast stats: ${e.message}`);
    }
  }

  const sendGroups = [
    { trangThai: "SENT", _count: { _all: sentCount } },
    { trangThai: "READ", _count: { _all: readCount } },
    { trangThai: "CONFIRMED", _count: { _all: confirmedCount } },
    { trangThai: "FAILED", _count: { _all: failedCount } },
    { trangThai: "PENDING", _count: { _all: pendingCount } },
  ];

  const channelGroups = Object.keys(channelMap).map((k) => ({
    kenh: k,
    _count: { _all: channelMap[k] },
  }));

  campaignList.sort((a, b) => new Date(b.ngayGui) - new Date(a.ngayGui));

  return {
    totalNotifs,
    sendGroups,
    channelGroups,
    surveyStats,
    campaignList: campaignList.slice(0, 15),
  };
}

module.exports = { execute, expandRecipients, getComprehensiveReportStats };

