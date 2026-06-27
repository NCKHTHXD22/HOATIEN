const { Schema, model } = require("mongoose");

// Gói đính kèm nội bộ (ảnh/ghi chú) cho tab Phân công & Xử lý
const attachmentBundleSchema = new Schema(
  {
    note:   { type: String, default: "" },
    images: [{ url: String, name: String }],
    file:   { url: { type: String, default: "" }, name: { type: String, default: "" } },
    sentBy: { type: String, default: null }, // id AdminUser (Postgres)
    sentAt: { type: Date, default: null },
  },
  { _id: false }
);

const feedbackSchema = new Schema(
  {
    userId:      { type: String, required: true, index: true }, // Zalo user_id người gửi
    displayName: { type: String, default: "" },
    contact:     { type: String, required: true },
    content:     { type: String, required: true },
    imageUrl:    { type: String, default: "" },
    imageUrls:   [{ type: String }],
    videoUrls:   [{ type: String }], // video minh hoạ người dân gửi qua chatbot
    linhVuc:     { type: String, default: "" }, // tên lĩnh vực (hiển thị)
    categoryId:  { type: String, default: null, index: true }, // _id Category
    // pending = mới, processing = đang xử lý/đã phân công, draft = dự thảo chờ duyệt,
    // resolved/done = đã gửi dân
    status:      { type: String, enum: ["pending", "processing", "draft", "resolved", "done"], default: "pending" },
    deadline:    { type: Date, default: null },
    // Phân công (id AdminUser Postgres dạng String)
    assignedTo:  { type: String, default: null },
    assignedBy:  { type: String, default: null },
    assignNote:  { type: String, default: "" },
    // Dự thảo phản hồi (cán bộ soạn)
    draftResponse: { type: String, default: "" },
    draftBy:       { type: String, default: null },
    draftAt:       { type: Date, default: null },
    draftAttachments: { type: attachmentBundleSchema, default: () => ({}) },
    // Duyệt / từ chối (lãnh đạo)
    approvedBy:     { type: String, default: null },
    rejectedReason: { type: String, default: "" },
    // Phản hồi cuối gửi dân
    finalResponse: { type: String, default: "" },
    sentAt:        { type: Date, default: null },
    createdAt:     { type: Date, default: Date.now, index: true },
    updatedAt:     { type: Date, default: null },
  },
  { collection: "feedbacks" }
);

module.exports = model("Feedback", feedbackSchema);
