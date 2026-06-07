const { Schema, model } = require("mongoose");

const SearchIndexSchema = new Schema(
  {
    householdId: { type: String, required: true, unique: true, index: true },
    soHoKhau:    { type: String },
    chuHoName:   { type: String },
    villageName: { type: String },
    villageId:   { type: String, index: true },
    tokens:      [{ type: String }],
    updatedAt:   { type: Date, default: Date.now },
  },
  { collection: "search_index" }
);

SearchIndexSchema.index({ tokens: "text", chuHoName: "text", soHoKhau: "text" });

module.exports = model("SearchIndex", SearchIndexSchema);
