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

// Khóa định danh 1 người: ưu tiên CCCD, không có thì Họ tên (chuẩn hóa) + Ngày sinh + Tổ
const _deacc = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D");
const _key = (s) => _deacc(s).toLowerCase().replace(/\s+/g, " ").trim();
const _ymd = (d) => {
  if (!d) return "";
  if (typeof d === "string") { const m = d.match(/^(\d{4}-\d{2}-\d{2})/); if (m) return m[1]; }
  const x = new Date(d);
  return isNaN(x) ? "" : `${x.getUTCFullYear()}-${String(x.getUTCMonth() + 1).padStart(2, "0")}-${String(x.getUTCDate()).padStart(2, "0")}`;
};
const ndKey = (hoTen, ngaySinh, to) => `nd:${_key(hoTen)}|${_ymd(ngaySinh)}|${_key(to)}`;

// Import Excel dạng UPSERT: cùng người (theo CCCD, hoặc Họ tên+Ngày sinh+Tổ)
// → cập nhật nếu có thay đổi / bỏ qua nếu giống; chưa có → thêm mới. Không xóa ai.
async function commitImport(parsed, villageId, performedBy) {
  const pad3 = (n) => String(n).padStart(3, "0");
  const to = parsed.to || "";

  // 1) Thôn
  let village;
  if (villageId) {
    village = await prisma.village.findUnique({ where: { id: villageId } });
    if (!village) throw new Error("Không tìm thấy thôn đã chọn");
  } else {
    village = await prisma.village.findUnique({ where: { ma: parsed.villageMaSuggest } });
    if (!village) village = await prisma.village.create({
      data: { ma: parsed.villageMaSuggest, ten: parsed.villageName || parsed.villageMaSuggest, moTa: "Xã Hòa Tiến - TP Đà Nẵng" },
    });
  }

  // 2) Nạp toàn bộ nhân khẩu hiện có để đối chiếu (quy mô 1 xã ~ vài nghìn → 1 query)
  const existing = await prisma.member.findMany({
    select: { id: true, hoTen: true, ngaySinh: true, gioiTinh: true, cccd: true, sdt: true, quanHeChuHo: true, laChuHo: true, householdId: true, household: { select: { to: true } } },
  });
  const byCccd = new Map();
  const byNd = new Map();
  for (const m of existing) {
    if (m.cccd) byCccd.set(m.cccd, m);
    byNd.set(ndKey(m.hoTen, m.ngaySinh, m.household?.to || to), m);
  }
  // Chỉ đối chiếu với DB CÓ SẴN lúc bắt đầu (không cập nhật map trong lúc import) —
  // để 2 hộ KHÁC NHAU trong cùng file (kể cả trùng tên+ngày sinh+tổ) không bị gộp vào nhau.
  const findExisting = (m) => (m.cccd && byCccd.get(m.cccd)) || byNd.get(ndKey(m.hoTen, m.ngaySinh, to)) || null;

  // Gộp cập nhật: chỉ ghi đè bằng giá trị KHÔNG rỗng của file (không xóa dữ liệu cũ bằng ô trống)
  const buildUpdate = (ex, m) => {
    const data = {};
    if (m.hoTen && m.hoTen !== ex.hoTen) data.hoTen = m.hoTen;
    if (_ymd(m.ngaySinh) && _ymd(m.ngaySinh) !== _ymd(ex.ngaySinh)) data.ngaySinh = new Date(m.ngaySinh);
    if (m.gioiTinh && m.gioiTinh !== ex.gioiTinh) data.gioiTinh = m.gioiTinh;
    if (m.sdt && m.sdt !== ex.sdt) data.sdt = m.sdt;
    if (m.quanHeChuHo && m.quanHeChuHo !== "Không có thông tin" && m.quanHeChuHo !== ex.quanHeChuHo) data.quanHeChuHo = m.quanHeChuHo;
    if (m.cccd && m.cccd !== ex.cccd) { const owner = byCccd.get(m.cccd); if (!owner || owner.id === ex.id) data.cccd = m.cccd; }
    return data;
  };
  const mkMember = (m, laChuHo) => normalizeMember({ hoTen: m.hoTen, ngaySinh: m.ngaySinh, gioiTinh: m.gioiTinh || null, cccd: m.cccd, sdt: m.sdt, quanHeChuHo: m.quanHeChuHo, laChuHo });

  const stats = { newHouseholds: 0, added: 0, updated: 0, skipped: 0 };
  const touched = new Set();
  const toNum = String(to).match(/\d+/)?.[0] || "";
  const prefix = `${village.ma}${toNum ? "-T" + toNum : ""}`;
  const diaChi = [to, parsed.villageName || village.ten, "Xã Hòa Tiến"].filter(Boolean).join(", ");
  let seq = await prisma.household.count({ where: { villageId: village.id, soHoKhau: { startsWith: prefix + "-" } } });

  const applyExisting = async (tx, ex, m) => {
    const upd = buildUpdate(ex, m);
    if (Object.keys(upd).length) { upd.updatedAt = new Date(); await tx.member.update({ where: { id: ex.id }, data: upd }); Object.assign(ex, upd); stats.updated++; }
    else stats.skipped++;
  };

  await prisma.$transaction(async (tx) => {
    for (const h of parsed.households) {
      const head = h.members.find((x) => x.laChuHo) || h.members[0];
      const headExisting = head ? findExisting(head) : null;

      if (headExisting) {
        // Hộ đã có → upsert từng thành viên vào đúng hộ hiện tại của chủ hộ
        const hhId = headExisting.householdId;
        for (const m of h.members) {
          const ex = findExisting(m);
          if (ex) { await applyExisting(tx, ex, m); touched.add(ex.householdId); }
          else {
            await tx.member.create({ data: { ...mkMember(m, false), householdId: hhId } });
            stats.added++; touched.add(hhId);
          }
        }
      } else {
        // Hộ mới → tạo hộ + thành viên mới; ai đã tồn tại theo CCCD thì cập nhật, không tạo trùng
        const toCreate = [];
        for (const m of h.members) {
          const exC = m.cccd ? byCccd.get(m.cccd) : null;
          if (exC) await applyExisting(tx, exC, m);
          else toCreate.push(mkMember(m, m.laChuHo));
        }
        if (toCreate.length) {
          seq += 1;
          const hh = await tx.household.create({
            data: { soHoKhau: `${prefix}-${pad3(seq)}`, diaChi, to: to || null, villageId: village.id, soNhanKhau: toCreate.length, members: { create: toCreate } },
            select: { id: true },
          });
          stats.newHouseholds++; stats.added += toCreate.length; touched.add(hh.id);
        }
      }
    }

    // Đồng bộ lại số nhân khẩu cho các hộ bị đụng
    for (const id of touched) {
      const cnt = await tx.member.count({ where: { householdId: id } });
      await tx.household.update({ where: { id }, data: { soNhanKhau: cnt } });
    }
  }, { timeout: 180000, maxWait: 20000 });

  AuditService.log({
    entityType: "village", entityId: village.id, action: "IMPORT",
    newData: { ...stats, thon: village.ten, to },
    performedBy, note: `Import Excel: +${stats.added} mới / ~${stats.updated} cập nhật / ${stats.skipped} bỏ qua`,
  });
  touched.forEach((id) => SearchService.syncIndex(id).catch(() => {}));
  ReportCacheRepo.invalidateAll().catch(() => {});

  return { village: { id: village.id, ten: village.ten, ma: village.ma }, ...stats };
}

module.exports = { getAll, getDistinctTo, getById, create, update, remove, splitHousehold, mergeHouseholds, commitImport, ndKey };
