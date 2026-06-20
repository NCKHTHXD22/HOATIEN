const MovementRepo = require("../repositories/pg/MovementRepo");
const HouseholdRepo = require("../repositories/pg/HouseholdRepo");
const AuditService = require("./AuditService");
const ReportCacheRepo = require("../repositories/mongo/ReportCacheRepo");

async function getAll(filters) {
  const [data, total] = await MovementRepo.findAll(filters);
  return { data, total };
}

async function create({ householdId, loai, ngay, nguonGoc, noiDen, ghiChu }, performedBy) {
  const household = await HouseholdRepo.findById(householdId);
  if (!household) throw new Error("Không tìm thấy hộ dân");

  const record = await MovementRepo.create({
    householdId,
    loai,
    ngay: new Date(ngay),
    nguonGoc: nguonGoc || null,
    noiDen: noiDen || null,
    ghiChu: ghiChu || null,
    performedById: performedBy,
  });

  AuditService.log({
    entityType: "household", entityId: householdId,
    action: loai === "MOVE_IN" ? "MOVE_IN" : "MOVE_OUT",
    newData: record, performedBy,
  });
  ReportCacheRepo.invalidateAll().catch(() => {});

  return record;
}

async function update(id, { loai, ngay, nguonGoc, noiDen, ghiChu }, performedBy) {
  const old = await MovementRepo.findById(id);
  if (!old) throw new Error("Không tìm thấy bản ghi biến động");

  const updated = await MovementRepo.update(id, {
    ...(loai && { loai }),
    ...(ngay && { ngay: new Date(ngay) }),
    nguonGoc: nguonGoc ?? old.nguonGoc,
    noiDen: noiDen ?? old.noiDen,
    ghiChu: ghiChu ?? old.ghiChu,
  });

  AuditService.log({
    entityType: "household", entityId: old.householdId, action: "UPDATE",
    oldData: old, newData: updated, performedBy, note: "Sửa bản ghi biến động",
  });
  ReportCacheRepo.invalidateAll().catch(() => {});

  return updated;
}

async function remove(id, performedBy) {
  const old = await MovementRepo.findById(id);
  if (!old) throw new Error("Không tìm thấy bản ghi biến động");

  await MovementRepo.remove(id);

  AuditService.log({
    entityType: "household", entityId: old.householdId, action: "DELETE",
    oldData: old, performedBy, note: "Xóa bản ghi biến động",
  });
  ReportCacheRepo.invalidateAll().catch(() => {});
}

module.exports = { getAll, create, update, remove };
