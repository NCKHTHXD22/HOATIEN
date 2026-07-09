const { Schema, model } = require("mongoose");

// Follower của OA (đồng bộ từ Zalo getfollowers). linkedMemberId = nhân khẩu đã liên kết (nếu có).
const ZaloFollowerSchema = new Schema(
  {
    userId:         { type: String, required: true, unique: true, index: true },
    displayName:    { type: String, default: "" },
    avatar:         { type: String, default: "" },
    phone:          { type: String, default: "" }, // SĐT dân tự chia sẻ qua form request_user_info
    linkedMemberId: { type: String, default: null, index: true },
    lastSyncedAt:   { type: Date, default: Date.now },
  },
  { collection: "zalo_followers" }
);

module.exports = model("ZaloFollower", ZaloFollowerSchema);
