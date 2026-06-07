const { Schema, model } = require("mongoose");

const ZaloEventSchema = new Schema(
  {
    type:        { type: String, required: true, enum: ["SEARCH", "WEBHOOK", "SEND_MESSAGE", "ERROR"] },
    zaloUserId:  { type: String, index: true },
    query:       { type: Schema.Types.Mixed, default: null },
    resultCount: { type: Number, default: 0 },
    payload:     { type: Schema.Types.Mixed, default: {} },
    processed:   { type: Boolean, default: true },
    timestamp:   { type: Date, default: Date.now, index: true },
  },
  { collection: "zalo_events" }
);

module.exports = model("ZaloEvent", ZaloEventSchema);
