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
    await ZaloService.sendMessage(member.zaloUserId, text);
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

module.exports = { execute, expandRecipients };
