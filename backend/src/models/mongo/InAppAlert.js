const { Schema, model } = require("mongoose");

const inAppAlertSchema = new Schema(
  {
    recipientId: { type: String, required: true, index: true }, // AdminUser.id (Postgres)
    type:        { type: String, required: true, enum: ["feedback_new", "feedback_assigned", "feedback_draft", "feedback_approved", "feedback_rejected"] },
    title:       { type: String, required: true },
    body:        { type: String, default: "" },
    refId:       { type: String, default: null }, // Feedback._id
    read:        { type: Boolean, default: false },
    createdAt:   { type: Date, default: Date.now, index: true },
  },
  { collection: "in_app_alerts" }
);

inAppAlertSchema.index({ recipientId: 1, read: 1, createdAt: -1 });

module.exports = model("InAppAlert", inAppAlertSchema);
