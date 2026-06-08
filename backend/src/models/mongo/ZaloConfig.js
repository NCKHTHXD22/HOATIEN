const mongoose = require("mongoose");

// Singleton document — luôn chỉ có 1 record với key="oa_token"
const ZaloConfigSchema = new mongoose.Schema(
  {
    key:          { type: String, required: true, unique: true },
    accessToken:  { type: String, default: null },
    refreshToken: { type: String, default: null },
    expiresAt:    { type: Date,   default: null }, // thời điểm access token hết hạn
    updatedAt:    { type: Date,   default: Date.now },
  },
  { collection: "zalo_configs" }
);

module.exports = mongoose.model("ZaloConfig", ZaloConfigSchema);
