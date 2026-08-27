const dotenv = require("dotenv");
const mongoose = require("mongoose");
const path = require("path");

dotenv.config({ path: path.join(__dirname, ".env") });

const ZaloEvent = require("./src/models/mongo/ZaloEvent");

async function main() {
  await mongoose.connect(process.env.MONGODB_URI, {
    dbName: process.env.MONGODB_DB_NAME,
  });
  console.log("Connected to MongoDB:", process.env.MONGODB_DB_NAME);
  
  const events = await ZaloEvent.find({}).sort({ timestamp: -1 }).limit(10).lean();
  console.log("Latest events:", JSON.stringify(events, null, 2));
  
  await mongoose.disconnect();
}

main().catch(console.error);
