const { Schema, model } = require("mongoose");

const ZaloSessionSchema = new Schema(
  {
    zaloUserId:  { type: String, required: true, unique: true, index: true },
    state:       { type: String, default: "IDLE", enum: ["IDLE", "AWAIT_TYPE", "AWAIT_QUERY", "SHOWING_RESULT"] },
    queryType:   { type: String, default: null, enum: ["name", "cccd", "sdt", null] },
    lastQuery:   { type: String, default: null },
    resultCount: { type: Number, default: 0 },
    context:     { type: Schema.Types.Mixed, default: {} },
    expiredAt:   { type: Date, expires: 0 },
  },
  { collection: "zalo_sessions" }
);

module.exports = model("ZaloSession", ZaloSessionSchema);
