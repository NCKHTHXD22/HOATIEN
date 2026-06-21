const { Schema, model } = require("mongoose");

const ScheduledBroadcastSchema = new Schema(
  {
    title:             { type: String, default: "" },
    message:           { type: String, default: "" },
    adminNote:         { type: String, default: "" },
    attachmentIds:     { type: [String], default: [] },
    videoAttachmentId: { type: String, default: null },
    fileAttachmentId:  { type: String, default: null },
    linkUrl:           { type: String, default: "" },
    linkTitle:         { type: String, default: "" },
    userIds:           { type: [String], default: [] },
    groupIds:          { type: [String], default: [] },
    scheduledAt:       { type: Date, required: true, index: true },
    status:            { type: String, default: "pending", enum: ["pending", "sending", "done", "failed", "cancelled"] },
    sent:              { type: Number, default: 0 },
    failed:            { type: Number, default: 0 },
    createdBy:         { type: String, default: "" },
    createdAt:         { type: Date, default: Date.now },
  },
  { collection: "scheduled_broadcasts" }
);

module.exports = model("ScheduledBroadcast", ScheduledBroadcastSchema);
