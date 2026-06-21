const { Schema, model } = require("mongoose");

const ZaloGroupMemberSchema = new Schema(
  {
    groupId:     { type: String, required: true, index: true }, // = Zalo group_id của nhóm
    zaloUserId:  { type: String, required: true },
    displayName: { type: String, default: "" },
    avatar:      { type: String, default: "" },
    createdAt:   { type: Date, default: Date.now },
  },
  { collection: "zalo_group_members" }
);

ZaloGroupMemberSchema.index({ groupId: 1, zaloUserId: 1 }, { unique: true });

module.exports = model("ZaloGroupMember", ZaloGroupMemberSchema);
