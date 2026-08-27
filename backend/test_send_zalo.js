require('dotenv').config();
const { connectDatabases, disconnectDatabases } = require('./src/config/database');
const ZaloService = require('./src/services/ZaloService');
const ZaloConfigRepo = require('./src/repositories/mongo/ZaloConfigRepo');

async function test() {
  await connectDatabases();
  await ZaloConfigRepo.initFromEnv().catch(() => {});
  try {
    console.log("Đang gửi tin nhắn Zalo tới user 3689754700559421830...");
    const results = await ZaloService.sendToFollowers(
      ["3689754700559421830"], 
      "Dạ chào anh/chị, đây là tin nhắn test từ hệ thống quản lý nhân khẩu Hòa Tiến. Nếu anh/chị nhận được tin nhắn này nghĩa là tính năng tích hợp Zalo OA đã hoạt động hoàn hảo 100% rồi ạ! 🎉"
    );
    console.log("SEND RESULTS:", results);
  } catch(err) {
    console.error("SEND ERROR:", err);
  }
  await disconnectDatabases();
}
test();
