const { Schema, model } = require("mongoose");

// Lĩnh vực phản ánh — mỗi loại gắn 1 nhóm Zalo (zaloGroupId) để thông báo cán bộ phụ trách
const categorySchema = new Schema(
  {
    name:        { type: String, required: true },
    zaloGroupId: { type: String, default: "" },
    icon:        { type: String, default: "📋" },
    order:       { type: Number, default: 0 },
  },
  { collection: "categories" }
);

module.exports = model("Category", categorySchema);
