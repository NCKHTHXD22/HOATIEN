const AuditLogRepo = require("../repositories/mongo/AuditLogRepo");
const logger = require("../utils/logger");

async function log({ entityType, entityId, action, oldData, newData, diff, performedBy, note }) {
  try {
    await AuditLogRepo.create({ entityType, entityId, action, oldData, newData, diff: diff || [], performedBy, note });
  } catch (err) {
    logger.error(`AuditService.log failed [${action} ${entityType}/${entityId}]: ${err.message}`);
  }
}

async function getHistory(entityType, entityId) {
  return AuditLogRepo.findByEntity(entityType, entityId);
}

async function getByPerformer(performedBy) {
  return AuditLogRepo.findByPerformer(performedBy);
}

module.exports = { log, getHistory, getByPerformer };
