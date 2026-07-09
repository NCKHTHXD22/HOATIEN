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

const setLink = (userId, memberId) =>
  ZaloFollower.findOneAndUpdate(
    { userId },
    { $set: { linkedMemberId: memberId }, $setOnInsert: { displayName: "", avatar: "" } },
    { new: true, upsert: true }
  );

// Lưu SĐT dân tự chia sẻ (form request_user_info)
const setPhone = (userId, phone) =>
  ZaloFollower.findOneAndUpdate(
    { userId },
    { $set: { phone: phone || "" }, $setOnInsert: { displayName: "", avatar: "", linkedMemberId: null } },
    { new: true, upsert: true }
  );

module.exports = { upsertMany, upsertIds, findAll, findByUserId, setLink, setPhone };
