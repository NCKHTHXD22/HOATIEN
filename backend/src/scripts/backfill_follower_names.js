// Điền tên/avatar cho các ZaloFollower đang rỗng displayName (gọi getprofile).
// Nguyên nhân rỗng: follower thêm qua liên kết-SĐT (chỉ lưu user_id), chưa qua đợt sync điền tên.
// Dry-run mặc định; chạy thật: node src/scripts/backfill_follower_names.js --apply
require("dotenv").config();
const { connectDatabases, disconnectDatabases } = require("../config/database");
const ZaloFollower = require("../models/mongo/ZaloFollower");
const ZaloFollowerRepo = require("../repositories/mongo/ZaloFollowerRepo");
const ZaloConfigRepo = require("../repositories/mongo/ZaloConfigRepo");
const axios = require("axios");

const APPLY = process.argv.includes("--apply");

async function getProfile(userId, token) {
  const data = encodeURIComponent(JSON.stringify({ user_id: String(userId) }));
  try {
    const r = await axios.get(`https://openapi.zalo.me/v2.0/oa/getprofile?data=${data}`, { headers: { access_token: token } });
    if (r.data?.error === 0) return { user_id: userId, display_name: r.data.data?.display_name || "", avatar: r.data.data?.avatar || "" };
  } catch { /* bỏ qua */ }
  return null;
}

(async () => {
  await connectDatabases();
  const token = await ZaloConfigRepo.getValidToken();
  const empties = await ZaloFollower.find({ $or: [{ displayName: "" }, { displayName: null }] }).lean();
  console.log(`Follower thiếu tên: ${empties.length}`);

  if (!APPLY) {
    console.log("(DRY-RUN — thêm --apply để backfill; chạy chậm ~0.3s/follower do Zalo giới hạn)");
    await disconnectDatabases();
    return;
  }

  let filled = 0, still = 0;
  for (const f of empties) {
    const p = await getProfile(f.userId, token);
    if (p && p.display_name) {
      await ZaloFollowerRepo.upsertMany([p]);
      filled++;
      if (filled <= 12) console.log(`  ✓ ${f.userId} → ${p.display_name}`);
    } else {
      still++;
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  console.log(`\n✅ Điền tên: ${filled} · vẫn rỗng (Zalo không trả tên): ${still}`);
  await disconnectDatabases();
})().catch((e) => { console.error(e.message); process.exit(1); });
