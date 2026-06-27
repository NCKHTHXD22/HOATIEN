const { Schema, model } = require("mongoose");

const BroadcastLogSchema = new Schema(
  {
    message:        { type: String, default: "" },
    recipientCount: { type: Number, default: 0 },
    sent:           { type: Number, default: 0 },
    failed:         { type: Number, default: 0 },
    adminNote:      { type: String, default: "" },
    timestamp:      { type: Date, default: Date.now, index: true },
  },
  { collection: "broadcast_logs" }
);

module.exports = model("BroadcastLog", BroadcastLogSchema);
