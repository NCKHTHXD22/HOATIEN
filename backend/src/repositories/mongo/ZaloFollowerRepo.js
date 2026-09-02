const ZaloFollower = require("../../models/mongo/ZaloFollower");

// Upsert hàng loạt profile follower từ kết quả sync (giữ nguyên linkedMemberId cũ)
const upsertMany = async (profiles) => {
  if (!profiles.length) return 0;
  const now = new Date();
  const ops = profiles.map((p) => ({
    updateOne: {
      filter: { userId: String(p.user_id) },
      update: {
        $set: { displayName: p.display_name || "", avatar: p.avatar || "", lastSyncedAt: now },
        $setOnInsert: { linkedMemberId: null },
      },
      upsert: true,
    },
  }));
  await ZaloFollower.bulkWrite(ops);
  return profiles.length;
};

// Chỉ chèn user_id mới (KHÔNG ghi đè displayName của follower đã có tên)
const upsertIds = async (ids) => {
  if (!ids.length) return 0;
  const now = new Date();
  const ops = ids.map((id) => ({
    updateOne: {
      filter: { userId: String(id) },
      update: {
        $set: { lastSyncedAt: now },
        $setOnInsert: { displayName: "", avatar: "", linkedMemberId: null },
      },
      upsert: true,
    },
  }));
  await ZaloFollower.bulkWrite(ops);
  return ids.length;
};

const findAll = () => ZaloFollower.find().sort({ displayName: 1 }).lean();

const findByUserId = (userId) => ZaloFollower.findOne({ userId }).lean();

// profile (tùy chọn): { displayName, avatar } — điền tên/avatar ngay khi liên kết,
// tránh follower mới bị "Không tên". Chỉ ghi khi có giá trị (không đè tên cũ bằng rỗng).
const setLink = (userId, memberId, profile = {}) => {
  const $set = { linkedMemberId: memberId };
  const $setOnInsert = {};
  if (profile.displayName) $set.displayName = profile.displayName; else $setOnInsert.displayName = "";
  if (profile.avatar) $set.avatar = profile.avatar; else $setOnInsert.avatar = "";
  const update = { $set };
  if (Object.keys($setOnInsert).length) update.$setOnInsert = $setOnInsert;
  return ZaloFollower.findOneAndUpdate({ userId }, update, { new: true, upsert: true });
};

// Lưu SĐT dân tự chia sẻ (form request_user_info)
const setPhone = (userId, phone) =>
  ZaloFollower.findOneAndUpdate(
    { userId },
    { $set: { phone: phone || "" }, $setOnInsert: { displayName: "", avatar: "", linkedMemberId: null } },
    { new: true, upsert: true }
  );

module.exports = { upsertMany, upsertIds, findAll, findByUserId, setLink, setPhone };
