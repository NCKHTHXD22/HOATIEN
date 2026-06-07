const { Schema, model } = require("mongoose");

const ReportCacheSchema = new Schema(
  {
    cacheKey:    { type: String, required: true, unique: true, index: true },
    data:        { type: Schema.Types.Mixed, required: true },
    generatedAt: { type: Date, default: Date.now },
    ttl:         { type: Number, default: 3600 },
    expiredAt:   { type: Date, expires: 0 },
  },
  { collection: "report_cache" }
);

module.exports = model("ReportCache", ReportCacheSchema);
