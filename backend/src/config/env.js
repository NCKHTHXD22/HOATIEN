require("dotenv").config();

const required = ["DATABASE_URL", "MONGODB_URI", "JWT_SECRET"];

for (const key of required) {
  if (!process.env[key]) {
    console.warn(`[ENV] Warning: ${key} is not set — some features may not work`);
  }
}

module.exports = {
  PORT: parseInt(process.env.PORT) || 3000,
  NODE_ENV: process.env.NODE_ENV || "development",
  isDev: process.env.NODE_ENV !== "production",

  DATABASE_URL: process.env.DATABASE_URL,
  MONGODB_URI: process.env.MONGODB_URI,
  MONGODB_DB_NAME: process.env.MONGODB_DB_NAME || "hoa_tien",

  JWT_SECRET: process.env.JWT_SECRET || "dev_secret_change_in_prod",
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "7d",

  ZALO_APP_ID: process.env.ZALO_APP_ID,
  ZALO_APP_SECRET: process.env.ZALO_APP_SECRET,
  ZALO_OA_ACCESS_TOKEN: process.env.ZALO_OA_ACCESS_TOKEN,
  ZALO_OA_REFRESH_TOKEN: process.env.ZALO_OA_REFRESH_TOKEN,
  ZALO_WEBHOOK_SECRET: process.env.ZALO_WEBHOOK_SECRET,

  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASS: process.env.SMTP_PASS,

  ESMS_API_KEY: process.env.ESMS_API_KEY,
  ESMS_SECRET_KEY: process.env.ESMS_SECRET_KEY,
  ESMS_BRANDNAME: process.env.ESMS_BRANDNAME || "HOATIEN",

  CORS_ORIGINS: (process.env.CORS_ORIGINS || "http://localhost:5173")
    .split(",")
    .map((s) => s.trim()),
};
