const { prisma } = require("../config/database");
const HouseholdRepo = require("../repositories/pg/HouseholdRepo");
const AuditService = require("./AuditService");
const SearchService = require("./SearchService");
const { computeDiff } = require("../utils/diff");

async function getAll(filters) {
  const [data, total] = await HouseholdRepo.findAll(filters);
  return { data, total };
}

async function getById(id) {
  const h = await HouseholdRepo.findById(id);
  if (!h) throw new Error("Không tìm thấy hộ dân");
  return h;
}

async function create({ soHoKhau, diaChi, lat, lng, trangThai, loaiHo, villageId, members = [] }, performedBy) {
  const exists = await HouseholdRepo.findBySoHoKhau(soHoKhau);
  if (exists) throw new Error("Số hộ khẩu đã tồn tại");

  const household = await HouseholdRepo.create(
    { soHoKhau, diaChi, lat, lng, trangThai, loaiHo, villageId },
    members
  );

  AuditService.log({ entityType: "household", entityId: household.id, action: "CREATE", newData: household, performedBy });
  SearchService.syncIndex(household.id).catch(() => {});

  return household;
}

async function update(id, newData, performedBy) {
  const oldData = await HouseholdRepo.findById(id);
  if (!oldData) throw new Error("Không tìm thấy hộ dân");

  const { members: _, ...householdData } = newData;
  const updated = await HouseholdRepo.update(id, householdData);

  AuditService.log({
    entityType: "household", entityId: id, action: "UPDATE",
    oldData, newData: updated, diff: computeDiff(oldData, updated), performedBy,
  });
  SearchService.syncIndex(id).catch(() => {});

  return updated;
}

async function remove(id, performedBy) {
  const old = await HouseholdRepo.findById(id);
  if (!old) throw new Error("Không tìm thấy hộ dân");
  await HouseholdRepo.remove(id);
  AuditService.log({ entityType: "household", entityId: id, action: "DELETE", oldData: old, performedBy });
}

async function splitHousehold({ sourceId, memberIds, newHeadId, newDiaChi, newVillageId, note }, performedBy) {
  const source = await HouseholdRepo.findById(sourceId);
  if (!source) throw new Error("Không tìm thấy hộ nguồn");

  const movingMembers = source.members.filter((m) => memberIds.includes(m.id));
  if (movingMembers.length === 0) throw new Error("Không có thành viên nào được chọn để tách");

  let newHousehold;
  await prisma.$transaction(async (tx) => {
    newHousehold = await tx.household.create({
      data: {
        soHoKhau: `${source.soHoKhau}-T${Date.now()}`,
        diaChi: newDiaChi || source.diaChi,
        villageId: newVillageId || source.villageId,
        loaiHo: source.loaiHo,
      },
    });

    await tx.member.updateMany({
      where: { id: { in: memberIds } },
      data: { householdId: newHousehold.id, laChuHo: false },
    });
    if (newHeadId) {
      await tx.member.update({ where: { id: newHeadId }, data: { laChuHo: true } });
    }

    const remaining = await tx.member.count({ where: { householdId: sourceId } });
    if (remaining === 0) {
      await tx.household.update({ where: { id: sourceId }, data: { trangThai: "DA_TACH" } });
    }

    await tx.householdRelation.create({
      data: { type: "SPLIT", sourceId, targetId: newHousehold.id, memberIds, note },
    });
  });

  const [updatedSource, updatedNew] = await Promise.all([
    HouseholdRepo.findById(sourceId),
    HouseholdRepo.findById(newHousehold.id),
  ]);

  AuditService.log({ entityType: "household", entityId: sourceId, action: "SPLIT", oldData: source, newData: updatedSource, performedBy, note });
  AuditService.log({ entityType: "household", entityId: newHousehold.id, action: "SPLIT", newData: updatedNew, performedBy, note });
  SearchService.syncIndex(sourceId).catch(() => {});
  SearchService.syncIndex(newHousehold.id).catch(() => {});

  return { source: updatedSource, newHousehold: updatedNew };
}

async function mergeHouseholds({ targetId, sourceIds, ghiChu }, performedBy) {
  // Validate hộ nhận
  const target = await HouseholdRepo.findById(targetId);
  if (!target) throw new Error("Không tìm thấy hộ nhận");
  if (target.trangThai === "DA_GIAI_THE") throw new Error("Hộ nhận đã giải thể, không thể gộp vào");

  // Không cho trùng target và source
  const uniqueSources = [...new Set(sourceIds)].filter((id) => id !== targetId);
  if (uniqueSources.length === 0) throw new Error("Hộ nguồn không thể trùng với hộ nhận");

  // Load tất cả hộ nguồn
  const sources = await Promise.all(uniqueSources.map((id) => HouseholdRepo.findById(id)));
  const missing = sources.findIndex((s) => !s);
  if (missing !== -1) throw new Error(`Không tìm thấy hộ nguồn: ${uniqueSources[missing]}`);

  const movedMemberIds = [];

  await prisma.$transaction(async (tx) => {
    for (const source of sources) {
      const activeMemberIds = (source.members || [])
        .filter((m) => m.trangThai === "ACTIVE")
        .map((m) => m.id);

      // Chuyển thành viên sang hộ nhận, bỏ flag chủ hộ cũ
      if (activeMemberIds.length > 0) {
        await tx.member.updateMany({
          where: { id: { in: activeMemberIds } },
          data: { householdId: targetId, laChuHo: false },
        });
        movedMemberIds.push(...activeMemberIds);
      }

      // Chỉ đánh DA_GIAI_THE nếu hộ đang ACTIVE
      if (source.trangThai === "ACTIVE") {
        await tx.household.update({
          where: { id: source.id },
          data: { trangThai: "DA_GIAI_THE" },
        });
      }

      // Ghi lịch sử quan hệ gộp hộ
      await tx.householdRelation.create({
        data: {
          type: "MERGE",
          sourceId: source.id,
          targetId,
          memberIds: activeMemberIds,
          note: ghiChu || `Gộp hộ ${source.soHoKhau} vào ${target.soHoKhau}`,
        },
      });

      // Ghi biến động MOVE_IN cho hộ nhận
      if (activeMemberIds.length > 0) {
        const isDiffVillage = source.villageId !== target.villageId;
        await tx.movementRecord.create({
          data: {
            householdId: targetId,
            loai: "MOVE_IN",
            ngay: new Date(),
            nguonGoc: isDiffVillage
              ? `${source.soHoKhau} (${source.village?.ten || "thôn khác"})`
              : source.soHoKhau,
            ghiChu: [
              `Gộp hộ từ ${source.soHoKhau}`,
              isDiffVillage ? "(khác thôn)" : null,
              ghiChu || null,
            ]
              .filter(Boolean)
              .join(" — "),
            performedById: performedBy,
          },
        });
      }
    }
  });

  // Audit log sau transaction
  const updatedTarget = await HouseholdRepo.findById(targetId);
  const sourceList = sources.map((s) => s.soHoKhau).join(", ");

  for (const source of sources) {
    AuditService.log({
      entityType: "household",
      entityId: source.id,
      action: "MERGE",
      oldData: source,
      newData: { trangThai: "DA_GIAI_THE", mergedIntoId: targetId, mergedInto: target.soHoKhau },
      performedBy,
      note: `Gộp vào hộ ${target.soHoKhau}${ghiChu ? " — " + ghiChu : ""}`,
    });
    SearchService.syncIndex(source.id).catch(() => {});
  }

  AuditService.log({
    entityType: "household",
    entityId: targetId,
    action: "MERGE",
    oldData: target,
    newData: updatedTarget,
    performedBy,
    note: `Nhận gộp từ: ${sourceList}${ghiChu ? " — " + ghiChu : ""}`,
  });
  SearchService.syncIndex(targetId).catch(() => {});

  return {
    target: updatedTarget,
    mergedCount: sources.length,
    membersMoved: movedMemberIds.length,
  };
}

module.exports = { getAll, getById, create, update, remove, splitHousehold, mergeHouseholds };
