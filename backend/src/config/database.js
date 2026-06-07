const { PrismaClient } = require("@prisma/client");
const mongoose = require("mongoose");
const env = require("./env");
const logger = require("../utils/logger");

const prisma = new PrismaClient({
  datasources: { db: { url: env.DATABASE_URL } },
  log: env.isDev ? ["query", "warn", "error"] : ["error"],
});

async function connectPostgres() {
  await prisma.$connect();
  logger.info("PostgreSQL connected via Prisma");
}

async function connectMongoDB() {
  await mongoose.connect(env.MONGODB_URI, {
    dbName: env.MONGODB_DB_NAME,
    maxPoolSize: 10,
  });
  logger.info(`MongoDB connected — db: ${env.MONGODB_DB_NAME}`);
}

async function connectDatabases() {
  const results = await Promise.allSettled([
    connectPostgres(),
    connectMongoDB(),
  ]);

  for (const result of results) {
    if (result.status === "rejected") {
      logger.error("DB connection error:", result.reason?.message);
    }
  }
}

async function disconnectDatabases() {
  await Promise.allSettled([
    prisma.$disconnect(),
    mongoose.disconnect(),
  ]);
}

module.exports = { prisma, connectDatabases, disconnectDatabases };
