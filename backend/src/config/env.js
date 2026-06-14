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

  // --- PostgreSQL (Neon) ---
  DATABASE_URL: process.env.DATABASE_URL,

  // --- MongoDB ---
  MONGODB_URI: process.env.MONGODB_URI,
  MONGODB_DB_NAME: process.env.MONGODB_DB_NAME || "hoa_tien",

  // --- JWT ---
  JWT_SECRET: process.env.JWT_SECRET || "dev_secret_change_in_prod",
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "7d",

  // --- Zalo OA ---
  ZALO_APP_ID: process.env.ZALO_APP_ID,
  ZALO_APP_SECRET: process.env.ZALO_APP_SECRET,
  ZALO_OA_ACCESS_TOKEN: process.env.ZALO_OA_ACCESS_TOKEN,
  ZALO_OA_REFRESH_TOKEN: process.env.ZALO_OA_REFRESH_TOKEN,
  ZALO_WEBHOOK_SECRET: process.env.ZALO_WEBHOOK_SECRET,

  // --- Cloudinary (lưu hình ảnh / video) ---
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,

  // --- Upstash Redis (lưu token Zalo OA) ---
  UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
  UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,

  // --- Email (Gmail SMTP) ---
  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASS: process.env.SMTP_PASS,

  // --- SMS (ESMS.vn) ---
  ESMS_API_KEY: process.env.ESMS_API_KEY,
  ESMS_SECRET_KEY: process.env.ESMS_SECRET_KEY,
  ESMS_BRANDNAME: process.env.ESMS_BRANDNAME || "HOATIEN",

  // --- CORS ---
  CORS_ORIGINS: (process.env.CORS_ORIGINS || "http://localhost:5173")
    .split(",")
    .map((s) => s.trim()),
};
