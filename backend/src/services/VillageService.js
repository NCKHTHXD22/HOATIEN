const VillageRepo = require("../repositories/pg/VillageRepo");
const AuditService = require("./AuditService");

async function getAll() { return VillageRepo.findAll(); }

async function getById(id) {
  const village = await VillageRepo.findById(id);
  if (!village) throw new Error("Không tìm thấy thôn");
  return village;
}

async function create(data, performedBy) {
  const village = await VillageRepo.create(data);
  AuditService.log({ entityType: "village", entityId: village.id, action: "CREATE", newData: village, performedBy });
  return village;
}

async function update(id, data, performedBy) {
  const old = await VillageRepo.findById(id);
  if (!old) throw new Error("Không tìm thấy thôn");
  const updated = await VillageRepo.update(id, data);
  AuditService.log({ entityType: "village", entityId: id, action: "UPDATE", oldData: old, newData: updated, performedBy });
  return updated;
}

async function remove(id, performedBy) {
  const old = await VillageRepo.findById(id);
  if (!old) throw new Error("Không tìm thấy thôn");
  await VillageRepo.remove(id);
  AuditService.log({ entityType: "village", entityId: id, action: "DELETE", oldData: old, performedBy });
}

module.exports = { getAll, getById, create, update, remove };
