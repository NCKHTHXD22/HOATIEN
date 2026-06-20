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

const findAll = () => ZaloFollower.find().sort({ displayName: 1 }).lean();

const findByUserId = (userId) => ZaloFollower.findOne({ userId }).lean();

const setLink = (userId, memberId) =>
  ZaloFollower.findOneAndUpdate({ userId }, { linkedMemberId: memberId }, { new: true });

module.exports = { upsertMany, findAll, findByUserId, setLink };
