const VillageRepo = require("../repositories/pg/VillageRepo");
const AuditService = require("./AuditService");
const ReportCacheRepo = require("../repositories/mongo/ReportCacheRepo");

async function getAll() { return VillageRepo.findAll(); }

async function getById(id) {
  const village = await VillageRepo.findById(id);
  if (!village) throw new Error("Không tìm thấy thôn");
  return village;
}

async function create(data, performedBy) {
  const village = await VillageRepo.create(data);
  AuditService.log({ entityType: "village", entityId: village.id, action: "CREATE", newData: village, performedBy });
  ReportCacheRepo.invalidateAll().catch(() => {});
  return village;
}

async function update(id, data, performedBy) {
  const old = await VillageRepo.findById(id);
  if (!old) throw new Error("Không tìm thấy thôn");
  const updated = await VillageRepo.update(id, data);
  AuditService.log({ entityType: "village", entityId: id, action: "UPDATE", oldData: old, newData: updated, performedBy });
  ReportCacheRepo.invalidateAll().catch(() => {});
  return updated;
}

async function remove(id, performedBy) {
  const old = await VillageRepo.findById(id);
  if (!old) throw new Error("Không tìm thấy thôn");

  const householdCount = old._count?.households ?? 0;
  if (householdCount > 0) {
    throw new Error(
      `Không thể xóa "${old.ten}" vì còn ${householdCount} hộ dân đang sinh sống. Vui lòng chuyển hoặc xóa các hộ dân trước.`
    );
  }

  await VillageRepo.remove(id);
  AuditService.log({ entityType: "village", entityId: id, action: "DELETE", oldData: old, performedBy });
  ReportCacheRepo.invalidateAll().catch(() => {});
}

module.exports = { getAll, getById, create, update, remove };
