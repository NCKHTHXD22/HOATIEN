const { Schema, model } = require("mongoose");

const NotificationSchema = new Schema(
  {
    channel:   { type: String, required: true, enum: ["ZALO", "EMAIL", "SYSTEM"] },
    to:        { type: String, required: true },
    payload:   { type: Schema.Types.Mixed, default: {} },
    status:    { type: String, default: "PENDING", enum: ["PENDING", "SENT", "FAILED"] },
    sentAt:    { type: Date, default: null },
    errorMsg:  { type: String, default: null },
    createdAt: { type: Date, default: Date.now, index: true },
  },
  { collection: "notifications" }
);

module.exports = model("Notification", NotificationSchema);
