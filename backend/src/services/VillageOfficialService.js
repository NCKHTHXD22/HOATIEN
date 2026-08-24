const VillageOfficialRepo = require("../repositories/pg/VillageOfficialRepo");
const AuditService = require("./AuditService");

async function getAll(filter) { return VillageOfficialRepo.findAll(filter); }

async function getById(id) {
  const official = await VillageOfficialRepo.findById(id);
  if (!official) throw new Error("Không tìm thấy cán bộ thôn");
  return official;
}

async function create(data, performedBy) {
  const official = await VillageOfficialRepo.create(data);
  AuditService.log({ entityType: "village_official", entityId: official.id, action: "CREATE", newData: official, performedBy });
  return official;
}

async function update(id, data, performedBy) {
  const old = await VillageOfficialRepo.findById(id);
  if (!old) throw new Error("Không tìm thấy cán bộ thôn");
  const updated = await VillageOfficialRepo.update(id, data);
  AuditService.log({ entityType: "village_official", entityId: id, action: "UPDATE", oldData: old, newData: updated, performedBy });
  return updated;
}

async function remove(id, performedBy) {
  const old = await VillageOfficialRepo.findById(id);
  if (!old) throw new Error("Không tìm thấy cán bộ thôn");
  await VillageOfficialRepo.remove(id);
  AuditService.log({ entityType: "village_official", entityId: id, action: "DELETE", oldData: old, performedBy });
}

module.exports = { getAll, getById, create, update, remove };
