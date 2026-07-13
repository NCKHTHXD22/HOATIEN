require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const path = require("path");
const env = require("./src/config/env");
const { connectDatabases, disconnectDatabases } = require("./src/config/database");
const routes = require("./src/routes/index");
const { errorHandler, notFoundHandler } = require("./src/middlewares/error.middleware");
const { startSyncJob } = require("./src/jobs/syncSearchIndex");
const { startScheduledNotificationsJob } = require("./src/jobs/scheduledNotifications");
const { startZaloTokenRefreshJob } = require("./src/jobs/zaloTokenRefresh");
const { startScheduledBroadcastJob } = require("./src/jobs/scheduledBroadcast");
const ZaloConfigRepo = require("./src/repositories/mongo/ZaloConfigRepo");
const logger = require("./src/utils/logger");

const app = express();

// ─── Middlewares ──────────────────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors({ origin: env.CORS_ORIGINS, credentials: true }));
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan(env.isDev ? "dev" : "combined"));

// Phục vụ file upload tĩnh
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ─── Root — Zalo site verification meta tag ───────────────
app.get("/", (req, res) => {
  const code = process.env.ZALO_VERIFIER_CODE || "UExa2QR4Dp9Ymf5bj_KVPN7eXsMTdb8pDJWm";
  res.type("html").send(
    `<!DOCTYPE html><html><head><meta name="zalo-platform-site-verification" content="${code}"/></head><body></body></html>`
  );
});

// ─── Health check ─────────────────────────────────────────
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    version: "1.0.0",
    project: "Hoa Tien Backend",
    timestamp: new Date().toISOString(),
  });
});

// ─── Zalo domain verification ─────────────────────────────
// Zalo yêu cầu file này tồn tại ở root domain để xác thực (nội dung khớp file Zalo phát)
app.get("/zalo_verifier*.html", (req, res) => {
  const code = process.env.ZALO_VERIFIER_CODE || "UExa2QR4Dp9Ymf5bj_KVPN7eXsMTdb8pDJWm";
  res.type("html").send(
    `<!DOCTYPE html>\n<html lang="en">\n\n<head>\n    <meta property="zalo-platform-site-verification" content="${code}" />\n</head>\n\n<body>\nThere Is No Limit To What You Can Accomplish Using Zalo!\n</body>\n\n</html>`
  );
});

// ─── Routes ───────────────────────────────────────────────
app.use("/api", routes);

// ─── Error handlers ───────────────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

// ─── Start ────────────────────────────────────────────────
async function start() {
  await connectDatabases();

  app.listen(env.PORT, () => {
    logger.info(`Server running on port ${env.PORT} [${env.NODE_ENV}]`);
    logger.info(`Health: http://localhost:${env.PORT}/health`);
  });

  startScheduledNotificationsJob();
  startZaloTokenRefreshJob();
  startScheduledBroadcastJob();

  // Khởi tạo Zalo token từ .env vào MongoDB (chỉ lần đầu nếu chưa có)
  ZaloConfigRepo.initFromEnv().catch((err) =>
    logger.warn(`Zalo token init: ${err.message}`)
  );

  if (env.NODE_ENV === "production") {
    startSyncJob();
  }
}

start().catch((err) => {
  logger.error("Failed to start server:", err);
  process.exit(1);
});

// ─── Graceful shutdown ────────────────────────────────────
process.on("SIGINT", async () => {
  logger.info("Shutting down...");
  await disconnectDatabases();
  process.exit(0);
});
process.on("SIGTERM", async () => {
  await disconnectDatabases();
  process.exit(0);
});
