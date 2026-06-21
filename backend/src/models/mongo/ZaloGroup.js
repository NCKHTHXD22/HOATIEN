const { Schema, model } = require("mongoose");

const ZaloGroupSchema = new Schema(
  {
    groupId: { type: String, required: true, unique: true, index: true },
    name:    { type: String, default: "" },
    createdAt: { type: Date, default: Date.now },
  },
  { collection: "zalo_groups" }
);

module.exports = model("ZaloGroup", ZaloGroupSchema);
