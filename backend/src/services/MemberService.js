const MemberRepo = require("../repositories/pg/MemberRepo");
const AuditService = require("./AuditService");
const SearchService = require("./SearchService");
const { computeDiff } = require("../utils/diff");
const { normalizeMember } = require("../utils/normalize");

async function getByHousehold(householdId) {
  return MemberRepo.findByHouseholdId(householdId);
}

async function getById(id) {
  const m = await MemberRepo.findById(id);
  if (!m) throw new Error("Không tìm thấy thành viên");
  return m;
}

async function create(data, performedBy) {
  const clean = normalizeMember(data);
  if (clean.cccd) {
    const exists = await MemberRepo.findByCCCD(clean.cccd);
    if (exists) throw new Error("CCCD đã tồn tại trong hệ thống");
  }
  const member = await MemberRepo.create(clean);
  AuditService.log({ entityType: "member", entityId: member.id, action: "CREATE", newData: member, performedBy });
  SearchService.syncIndex(member.householdId).catch(() => {});
  return member;
}

async function update(id, data, performedBy) {
  const old = await MemberRepo.findById(id);
  if (!old) throw new Error("Không tìm thấy thành viên");
  const clean = normalizeMember(data);
  if (clean.cccd && clean.cccd !== old.cccd) {
    const dup = await MemberRepo.findByCCCD(clean.cccd);
    if (dup) throw new Error("CCCD đã tồn tại trong hệ thống");
  }
  const updated = await MemberRepo.update(id, clean);
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
