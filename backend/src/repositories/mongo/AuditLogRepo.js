const AuditLog = require("../../models/mongo/AuditLog");

const create = (data) => AuditLog.create(data);

const findByEntity = (entityType, entityId, limit = 50) =>
  AuditLog.find({ entityType, entityId })
    .sort({ performedAt: -1 })
    .limit(limit)
    .lean();

const findByPerformer = (performedBy, limit = 100) =>
  AuditLog.find({ performedBy }).sort({ performedAt: -1 }).limit(limit).lean();

const findRecent = (limit = 100) =>
  AuditLog.find().sort({ performedAt: -1 }).limit(limit).lean();

module.exports = { create, findByEntity, findByPerformer, findRecent };
