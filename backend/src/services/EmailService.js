const nodemailer = require("nodemailer");
const env = require("../config/env");
const logger = require("../utils/logger");

let _transporter = null;

function getTransporter() {
  if (!_transporter) {
    if (!env.SMTP_USER || !env.SMTP_PASS) {
      throw new Error("Email chưa cấu hình (SMTP_USER / SMTP_PASS)");
    }
    _transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
    });
  }
  return _transporter;
}

async function sendEmail({ to, subject, html, attachments = [] }) {
  const transport = getTransporter();
  const info = await transport.sendMail({
    from: `"UBND Xã Hòa Tiến" <${env.SMTP_USER}>`,
    to,
    subject,
    html,
    attachments,
  });
  logger.info(`Email sent to ${to}: ${info.messageId}`);
  return info;
}

module.exports = { sendEmail };
