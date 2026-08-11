const { Schema, model } = require("mongoose");

// Broadcast "Nội dung" (kiểu Zalo OA Manager) — tách riêng khỏi BroadcastLog của MessagesPage.
const BroadcastSchema = new Schema(
  {
    name:              { type: String, default: "" },   // Tên broadcast
    content:           { type: String, default: "" },   // Nội dung tin
    thumbnail:         { type: String, default: "" },   // URL Cloudinary hiển thị ở bảng
    imageAttachmentId: { type: String, default: null }, // attachment_id Zalo để gửi ảnh trong tin
    linkUrl:           { type: String, default: "" },
    linkTitle:         { type: String, default: "" },
    recipientCount:    { type: Number, default: 0 },
    sent:              { type: Number, default: 0 },
    failed:            { type: Number, default: 0 },
    views:             { type: Number, default: 0 },    // đếm click qua link theo dõi
    status:            { type: String, enum: ["sending", "success", "failed"], default: "sending" },
    userIds:           { type: [String], default: [] },
    groupIds:          { type: [String], default: [] },
    createdBy:         { type: String, default: "" },
    publishedAt:       { type: Date, default: Date.now, index: true },
  },
  { collection: "broadcasts" }
);

module.exports = model("Broadcast", BroadcastSchema);
