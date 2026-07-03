const { prisma } = require("../config/database");
const HouseholdRepo = require("../repositories/pg/HouseholdRepo");
const AuditService = require("./AuditService");
const SearchService = require("./SearchService");
const ReportCacheRepo = require("../repositories/mongo/ReportCacheRepo");
const { computeDiff } = require("../utils/diff");
const { normalizeMember } = require("../utils/normalize");

async function getAll(filters) {
  const [data, total] = await HouseholdRepo.findAll(filters);
  return { data, total };
}

async function getDistinctTo(villageId) {
  return HouseholdRepo.findDistinctTo(villageId);
}

async function getById(id) {
  const h = await HouseholdRepo.findById(id);
  if (!h) throw new Error("Không tìm thấy hộ dân");
  return h;
}

async function create({ soHoKhau, diaChi, to, lat, lng, trangThai, loaiHo, villageId, members = [] }, performedBy) {
  const exists = await HouseholdRepo.findBySoHoKhau(soHoKhau);
  if (exists) throw new Error("Số hộ khẩu đã tồn tại");

  const household = await HouseholdRepo.create(
    { soHoKhau, diaChi, to, lat, lng, trangThai, loaiHo, villageId },
    members.map(normalizeMember)
  );

  AuditService.log({ entityType: "household", entityId: household.id, action: "CREATE", newData: household, performedBy });
  SearchService.syncIndex(household.id).catch(() => {});
  ReportCacheRepo.invalidateAll().catch(() => {});

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
  ReportCacheRepo.invalidateAll().catch(() => {});

  return updated;
}

async function remove(id, performedBy) {
  const old = await HouseholdRepo.findById(id);
  if (!old) throw new Error("Không tìm thấy hộ dân");

  // Chỉ nhân khẩu CHƯA chuyển đi (ACTIVE) mới chặn xóa hộ. Nhân khẩu đã
  // chuyển đi/đã mất (DA_CHUYEN_DI/DA_MAN) chỉ còn là bản ghi lịch sử —
  // xóa kèm hộ luôn để không vướng khóa ngoại (members_householdId_fkey).
  const activeMembers = (old.members || []).filter((m) => m.trangThai === "ACTIVE");
  if (activeMembers.length > 0) {
    throw new Error(
      `Không thể xóa hộ "${old.soHoKhau}" vì còn ${activeMembers.length} nhân khẩu chưa chuyển đi. Vui lòng chuyển hộ/cập nhật trạng thái cho hết nhân khẩu trước khi xóa.`
    );
  }

  const leftoverMemberIds = old.members.map((m) => m.id);

  await prisma.$transaction(async (tx) => {
    if (leftoverMemberIds.length > 0) {
      // notification_sends.memberId là RESTRICT nên phải xóa trước Member
      await tx.notificationSend.deleteMany({ where: { memberId: { in: leftoverMemberIds } } });
      await tx.member.deleteMany({ where: { id: { in: leftoverMemberIds } } });
    }
    await tx.movementRecord.deleteMany({ where: { householdId: id } });
    await tx.household.delete({ where: { id } });
  });

  AuditService.log({ entityType: "household", entityId: id, action: "DELETE", oldData: old, performedBy });
  ReportCacheRepo.invalidateAll().catch(() => {});
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
  ReportCacheRepo.invalidateAll().catch(() => {});

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
  ReportCacheRepo.invalidateAll().catch(() => {});

  return {
    target: updatedTarget,
    mergedCount: sources.length,
    membersMoved: movedMemberIds.length,
  };
}

// Ghi hàng loạt hộ + nhân khẩu từ kết quả parse Excel. Toàn bộ trong 1 transaction.
async function commitImport(parsed, villageId, performedBy) {
  const pad3 = (n) => String(n).padStart(3, "0");

  // 1) Xác định thôn: dùng thôn đã chọn, hoặc tìm/tạo theo mã suy ra từ file
  let village;
  if (villageId) {
    village = await prisma.village.findUnique({ where: { id: villageId } });
    if (!village) throw new Error("Không tìm thấy thôn đã chọn");
  } else {
    village = await prisma.village.findUnique({ where: { ma: parsed.villageMaSuggest } });
    if (!village) {
      village = await prisma.village.create({
        data: { ma: parsed.villageMaSuggest, ten: parsed.villageName || parsed.villageMaSuggest, moTa: "Xã Hòa Tiến - TP Đà Nẵng" },
      });
    }
  }

  // 2) Sinh mã hộ khẩu: <MÃ THÔN>[-T<số tổ>]-<seq>, tiếp nối số hộ đã có cùng prefix
  const toNum = String(parsed.to || "").match(/\d+/)?.[0] || "";
  const prefix = `${village.ma}${toNum ? "-T" + toNum : ""}`;
  const existed = await prisma.household.count({ where: { villageId: village.id, soHoKhau: { startsWith: prefix + "-" } } });
  let seq = existed;
  const diaChi = [parsed.to, parsed.villageName || village.ten, "Xã Hòa Tiến"].filter(Boolean).join(", ");

  const createdIds = [];
  await prisma.$transaction(async (tx) => {
    for (const h of parsed.households) {
      seq += 1;
      const members = h.members.map((m) =>
        normalizeMember({ hoTen: m.hoTen, ngaySinh: m.ngaySinh, sdt: m.sdt, quanHeChuHo: m.quanHeChuHo, laChuHo: m.laChuHo })
      );
      const row = await tx.household.create({
        data: {
          soHoKhau: `${prefix}-${pad3(seq)}`,
          diaChi,
          to: parsed.to || null,
          villageId: village.id,
          soNhanKhau: members.length,
          members: { create: members },
        },
        select: { id: true },
      });
      createdIds.push(row.id);
    }
  }, { timeout: 120000, maxWait: 20000 });

  AuditService.log({
    entityType: "village", entityId: village.id, action: "IMPORT",
    newData: { households: createdIds.length, members: parsed.memberCount, thon: village.ten, to: parsed.to },
    performedBy, note: `Import Excel: ${createdIds.length} hộ / ${parsed.memberCount} nhân khẩu`,
  });
  createdIds.forEach((id) => SearchService.syncIndex(id).catch(() => {}));
  ReportCacheRepo.invalidateAll().catch(() => {});

  return { village: { id: village.id, ten: village.ten, ma: village.ma }, households: createdIds.length, members: parsed.memberCount };
}

module.exports = { getAll, getDistinctTo, getById, create, update, remove, splitHousehold, mergeHouseholds, commitImport };
