const MovementRepo = require("../repositories/pg/MovementRepo");
const HouseholdRepo = require("../repositories/pg/HouseholdRepo");
const AuditService = require("./AuditService");

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

  return record;
}

module.exports = { getAll, create };
