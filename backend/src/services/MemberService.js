const MemberRepo = require("../repositories/pg/MemberRepo");
const AuditService = require("./AuditService");
const SearchService = require("./SearchService");
const { computeDiff } = require("../utils/diff");

async function getByHousehold(householdId) {
  return MemberRepo.findByHouseholdId(householdId);
}

async function getById(id) {
  const m = await MemberRepo.findById(id);
  if (!m) throw new Error("Không tìm thấy thành viên");
  return m;
}

async function create(data, performedBy) {
  if (data.cccd) {
    const exists = await MemberRepo.findByCCCD(data.cccd);
    if (exists) throw new Error("CCCD đã tồn tại trong hệ thống");
  }
  const member = await MemberRepo.create(data);
  AuditService.log({ entityType: "member", entityId: member.id, action: "CREATE", newData: member, performedBy });
  SearchService.syncIndex(member.householdId).catch(() => {});
  return member;
}

async function update(id, data, performedBy) {
  const old = await MemberRepo.findById(id);
  if (!old) throw new Error("Không tìm thấy thành viên");
  if (data.cccd && data.cccd !== old.cccd) {
    const dup = await MemberRepo.findByCCCD(data.cccd);
    if (dup) throw new Error("CCCD đã tồn tại trong hệ thống");
  }
  const updated = await MemberRepo.update(id, data);
  AuditService.log({
    entityType: "member", entityId: id, action: "UPDATE",
    oldData: old, newData: updated, diff: computeDiff(old, updated), performedBy,
  });
  SearchService.syncIndex(updated.householdId).catch(() => {});
  return updated;
}

async function remove(id, performedBy) {
  const old = await MemberRepo.findById(id);
  if (!old) throw new Error("Không tìm thấy thành viên");
  await MemberRepo.remove(id);
  AuditService.log({ entityType: "member", entityId: id, action: "DELETE", oldData: old, performedBy });
  SearchService.syncIndex(old.householdId).catch(() => {});
}

module.exports = { getByHousehold, getById, create, update, remove };
