const ZaloGroup = require("../models/mongo/ZaloGroup");
const ZaloGroupMember = require("../models/mongo/ZaloGroupMember");
const zaloGmf = require("../utils/zaloGmf");

// Gọi từ webhook khi có người xin vào nhóm — chỉ duyệt nếu nhóm đã bật autoApprove
async function autoApproveIfEnabled(groupId, rawUsers) {
  const group = await ZaloGroup.findOne({ groupId: String(groupId) }).lean();
  if (!group?.autoApprove) return;

  const ids = rawUsers.map((u) => (typeof u === "string" ? u : u?.id)).filter(Boolean);
  if (!ids.length) return;

  await zaloGmf.acceptGroupJoinRequest(groupId, ids);

  for (const u of rawUsers) {
    const uid = typeof u === "string" ? u : u?.id;
    if (!uid) continue;
    await ZaloGroupMember.findOneAndUpdate(
      { groupId: String(groupId), zaloUserId: String(uid) },
      { $set: { displayName: (u.name || u.display_name || ""), avatar: (u.avatar || "") } },
      { upsert: true }
    ).catch(() => {});
  }
}

module.exports = { autoApproveIfEnabled };
