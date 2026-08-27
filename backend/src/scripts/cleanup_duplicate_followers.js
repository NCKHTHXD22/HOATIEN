const dns = require("dns");
dns.setServers(["8.8.8.8", "1.1.1.1"]);
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder("ipv4first");
}

const dotenv = require("dotenv");
const path = require("path");
const mongoose = require("mongoose");
const axios = require("axios").default;

dotenv.config({ path: path.join(__dirname, "..", "..", ".env") });

const ZaloConfigRepo = require("../repositories/mongo/ZaloConfigRepo");
const ZaloFollower = require("../models/mongo/ZaloFollower");
const ZaloEvent = require("../models/mongo/ZaloEvent");
const { prisma } = require("../config/database");

async function fetchAllActiveFollowerIds() {
  const ids = [];
  let offset = 0;
  const count = 50;

  const token = await ZaloConfigRepo.getValidToken().catch(() => null);
  if (!token) {
    console.log("⚠️ Không tìm thấy token Zalo OA hợp lệ. Sẽ dựa vào lịch sử webhook ZaloEvent.");
    return null;
  }

  console.log("🤖 Đang tải danh sách follower hoạt động từ Zalo OA API...");
  while (true) {
    try {
      const data = encodeURIComponent(JSON.stringify({ offset, count }));
      const response = await axios.get(`https://openapi.zalo.me/v2.0/oa/getfollowers?data=${data}`, {
        headers: { access_token: token },
        timeout: 10000,
      });

      const result = response.data;
      if (result?.error !== 0) {
        console.error(`❌ Zalo getfollowers error ${result?.error}: ${result?.message}`);
        break;
      }
      const followers = result?.data?.followers || [];
      for (const f of followers) ids.push(String(f.user_id));
      if (followers.length < count) break;
      offset += count;
      await new Promise((r) => setTimeout(r, 200));
    } catch (e) {
      console.error(`❌ Lỗi khi gọi Zalo API: ${e.message}`);
      break;
    }
  }
  console.log(`✅ Lấy thành công ${ids.length} follower ID từ Zalo OA.`);
  return ids;
}

async function main() {
  // Connect databases
  await mongoose.connect(process.env.MONGODB_URI, {
    dbName: process.env.MONGODB_DB_NAME || "hoa_tien"
  });
  console.log("💾 Đã kết nối MongoDB.");
  await prisma.$connect();
  console.log("💾 Đã kết nối PostgreSQL (Prisma).");

  // 1. Lấy tất cả follower hiện tại trong DB
  const followers = await ZaloFollower.find({}).lean();
  console.log(`📊 Tổng số follower trong MongoDB: ${followers.length}`);

  // 2. Lấy danh sách ID thật từ Zalo OA
  const activeIds = await fetchAllActiveFollowerIds();

  // 3. Phân tích các sự kiện follow từ ZaloEvent để ánh xạ app-scoped -> OA-scoped
  console.log("🔍 Đang đọc log ZaloEvent...");
  const followEvents = await ZaloEvent.find({
    type: "WEBHOOK",
    "payload.event_name": "follow"
  }).lean();

  const appToRealMap = new Map(); // app-scoped ID -> real OA-scoped ID
  for (const event of followEvents) {
    const appScoped = event.payload?.user_id_by_app;
    const real = event.payload?.follower?.id;
    if (appScoped && real && appScoped !== real) {
      appToRealMap.set(String(appScoped), String(real));
    }
  }
  console.log(`✅ Tìm thấy ${appToRealMap.size} ánh xạ ID từ log ZaloEvent.`);

  // 4. Tìm các bản ghi bị trùng (nhóm theo tên) để có thêm thông tin
  const groupedByName = {};
  for (const f of followers) {
    if (!f.displayName) continue;
    const key = f.displayName.trim().toLowerCase();
    if (!groupedByName[key]) groupedByName[key] = [];
    groupedByName[key].push(f);
  }

  let mergedCount = 0;
  let deletedCount = 0;
  let updatedCount = 0;

  // Lặp qua tất cả follower để tìm và xử lý các bản ghi app-scoped (bản ghi rác/trùng)
  for (const follower of followers) {
    const userIdStr = String(follower.userId);
    let realId = appToRealMap.get(userIdStr);

    // Nếu không có trong ZaloEvent map, thử kiểm tra thông qua danh sách activeIds từ Zalo OA API
    if (!realId && activeIds && !activeIds.includes(userIdStr)) {
      // Tìm xem có bản ghi nào trùng tên mà ID của nó nằm trong danh sách activeIds không
      const nameKey = (follower.displayName || "").trim().toLowerCase();
      const sameNameList = groupedByName[nameKey] || [];
      const matchInActive = sameNameList.find(f => activeIds.includes(String(f.userId)));
      if (matchInActive) {
        realId = String(matchInActive.userId);
        console.log(`💡 Khớp trùng tên "${follower.displayName}": ID không hoạt động ${userIdStr} -> ID hoạt động ${realId}`);
      }
    }

    if (realId) {
      console.log(`\n⚙️ Đang xử lý bản ghi app-scoped/trùng: Name: "${follower.displayName}", ID sai: ${userIdStr} -> ID đúng: ${realId}`);
      
      const realFollower = await ZaloFollower.findOne({ userId: realId });
      
      if (realFollower) {
        // Cả 2 bản ghi đều tồn tại -> Gộp dữ liệu từ bản ghi sai sang bản ghi đúng
        let modified = false;
        if (!realFollower.phone && follower.phone) {
          realFollower.phone = follower.phone;
          modified = true;
          console.log(`   + Cập nhật SĐT: ${follower.phone}`);
        }
        if (!realFollower.linkedMemberId && follower.linkedMemberId) {
          realFollower.linkedMemberId = follower.linkedMemberId;
          modified = true;
          console.log(`   + Cập nhật liên kết Nhân khẩu: ${follower.linkedMemberId}`);
        }
        if (modified) {
          await realFollower.save();
        }

        // Xóa bản ghi app-scoped trùng lặp
        await ZaloFollower.deleteOne({ _id: follower._id });
        deletedCount++;
        mergedCount++;
        console.log(`   ❌ Đã xóa bản ghi app-scoped ID ${userIdStr}`);
      } else {
        // Chỉ có bản ghi app-scoped tồn tại -> Đổi userId thành OA-scoped ID
        await ZaloFollower.updateOne({ _id: follower._id }, { $set: { userId: realId } });
        updatedCount++;
        console.log(`   ✏️ Đã đổi userId thành ${realId}`);
      }

      // 5. Cập nhật liên kết trong PostgreSQL nếu có
      const pgMembers = await prisma.member.findMany({
        where: { zaloUserId: userIdStr },
        select: { id: true, hoTen: true }
      });

      if (pgMembers.length > 0) {
        for (const m of pgMembers) {
          await prisma.member.update({
            where: { id: m.id },
            data: { zaloUserId: realId }
          });
          console.log(`   🐘 Cập nhật liên kết PostgreSQL của nhân khẩu "${m.hoTen}" (${m.id}): ${userIdStr} -> ${realId}`);
        }
      }
    }
  }

  console.log(`\n==================================================`);
  console.log(`🎉 HOÀN THÀNH DỌN DẸP DUPLICATES:`);
  console.log(`- Đã xóa bản ghi trùng: ${deletedCount}`);
  console.log(`- Đã gộp thông tin: ${mergedCount}`);
  console.log(`- Đã cập nhật ID chính xác: ${updatedCount}`);
  console.log(`==================================================`);

  // Disconnect
  await prisma.$disconnect();
  await mongoose.disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  await mongoose.disconnect();
});
