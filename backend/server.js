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

// ─── Health check ─────────────────────────────────────────
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    version: "1.0.0",
    project: "Hoa Tien Backend",
    timestamp: new Date().toISOString(),
  });
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
