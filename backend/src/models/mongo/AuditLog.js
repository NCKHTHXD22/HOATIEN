const { Schema, model } = require("mongoose");

const AuditLogSchema = new Schema(
  {
    entityType: { type: String, required: true, enum: ["household", "member", "village", "admin"] },
    entityId:   { type: String, required: true, index: true },
    action:     { type: String, required: true, enum: ["CREATE", "UPDATE", "DELETE", "SPLIT", "MERGE", "MOVE_IN", "MOVE_OUT"] },
    oldData:    { type: Schema.Types.Mixed, default: null },
    newData:    { type: Schema.Types.Mixed, default: null },
    diff:       [{ field: String, from: Schema.Types.Mixed, to: Schema.Types.Mixed }],
    performedBy: { type: String, required: true },
    performedAt: { type: Date, default: Date.now, index: true },
    note:        { type: String, default: null },
  },
  { collection: "audit_logs" }
);

AuditLogSchema.index({ entityType: 1, entityId: 1 });
AuditLogSchema.index({ performedBy: 1 });

module.exports = model("AuditLog", AuditLogSchema);
