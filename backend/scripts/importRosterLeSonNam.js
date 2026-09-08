// Import roster "Kích hoạt BHYT Lệ Sơn Nam.xlsx" → bổ sung nhân khẩu/hộ vào thôn Lệ Sơn Nam.
// File cột: STT | HỌ TÊN | HỌ TÊN CHỦ HỘ | SĐT | ĐỊA CHỈ | GHI CHÚ (header dòng 1).
// - Nhóm theo TÊN chủ hộ; nếu chủ hộ không có dòng riêng → tạo bản ghi chủ hộ từ cột CHỦ HỘ.
// - Dedup theo SĐT + họ tên (chuẩn hóa) so với dân hiện có của thôn; không tạo trùng.
// - Không có ngày sinh/CCCD/giới tính trong file → để trống.
// Dry-run mặc định; thêm --commit để ghi thật.
//   node scripts/importRosterLeSonNam.js "<đường dẫn .xlsx>"
//   node scripts/importRosterLeSonNam.js "<đường dẫn .xlsx>" --commit
require("dotenv").config();
const path = require("path");
const ExcelJS = require("exceljs");
const { PrismaClient } = require("@prisma/client");
const { normalizeMember, toProperName } = require("../src/utils/normalize");

const prisma = new PrismaClient();
const args = process.argv.slice(2).filter((a) => a !== "--commit");
const COMMIT = process.argv.includes("--commit");
const EXCEL_PATH = args[0] || "C:/Users/DELL/Downloads/Kích hoạt BHYT Lệ Sơn Nam.xlsx";
const VILLAGE_NAME = "Lệ Sơn Nam";

const pad3 = (n) => String(n).padStart(3, "0");
const normKey = (s) =>
  (s || "").toString().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/gi, "d")
    .toLowerCase().replace(/\s+/g, " ").trim();

function cleanPhone(raw) {
  if (raw == null) return null;
  let s = String(raw).replace(/[^\d]/g, "");
  if (/^\d{9}$/.test(s)) s = "0" + s; // Excel làm mất số 0 đầu
  return /^0\d{9}$/.test(s) ? s : null;
}
const cellStr = (c) => { let v = c && c.value; if (v && typeof v === "object" && v.text) v = v.text; return v == null ? "" : String(v).trim(); };

async function readRows() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path.resolve(EXCEL_PATH));
  const ws = wb.worksheets[0];
  const rows = [];
  for (let r = 2; r <= ws.rowCount; r++) {
    const g = ws.getRow(r);
    const hoTen = cellStr(g.getCell(2));
    if (!hoTen) continue;
    const chuHo = cellStr(g.getCell(3)) || hoTen;
    const rawPhone = cellStr(g.getCell(4));
    const diaChi = cellStr(g.getCell(5));
    const to = /^Tổ\s*\d/i.test(diaChi) ? diaChi.replace(/\s+/g, " ").trim() : null;
    rows.push({ hoTen: toProperName(hoTen), chuHo: toProperName(chuHo), sdtRaw: rawPhone, sdt: cleanPhone(rawPhone), to });
  }
  return rows;
}

async function main() {
  console.log(`Đọc file: ${EXCEL_PATH}`);
  const rows = await readRows();
  console.log(`Số dòng người: ${rows.length}`);
  const badPhone = rows.filter((r) => r.sdtRaw && !r.sdt).length;

  // Nhóm theo tên chủ hộ
  const groups = new Map();
  for (const r of rows) {
    const key = normKey(r.chuHo);
    if (!groups.has(key)) groups.set(key, { chuHo: r.chuHo, rows: [] });
    groups.get(key).rows.push(r);
  }
  // Cảnh báo: nhóm có >1 dòng tự nhận là chủ hộ (có thể là 2 hộ trùng tên bị gộp)
  const dupHeadNames = [];
  for (const g of groups.values()) {
    const selfHeads = g.rows.filter((r) => normKey(r.hoTen) === normKey(g.chuHo)).length;
    if (selfHeads > 1) dupHeadNames.push(`${g.chuHo} (${selfHeads})`);
  }

  const village = await prisma.village.findFirst({ where: { ten: { equals: VILLAGE_NAME, mode: "insensitive" } } });
  if (!village) throw new Error(`Không tìm thấy thôn ${VILLAGE_NAME}`);

  // Dân hiện có của thôn → map dedup
  const existing = await prisma.member.findMany({
    where: { household: { villageId: village.id } },
    select: { id: true, hoTen: true, sdt: true, householdId: true },
  });
  const byPhone = new Map(); existing.forEach((m) => { if (m.sdt) byPhone.set(m.sdt, m); });
  const byName = new Map(); existing.forEach((m) => { const k = normKey(m.hoTen); if (!byName.has(k)) byName.set(k, m); });
  const findExisting = (hoTen, sdt) => (sdt && byPhone.get(sdt)) || byName.get(normKey(hoTen)) || null;

  // Prefix + seq từ mã hộ hiện có
  const hhs = await prisma.household.findMany({ where: { villageId: village.id }, select: { soHoKhau: true } });
  let prefix = null, maxSeq = 0;
  for (const h of hhs) { const m = (h.soHoKhau || "").match(/^(.*)-(\d+)$/); if (m) { prefix = prefix || m[1]; maxSeq = Math.max(maxSeq, parseInt(m[2], 10)); } }
  if (!prefix) prefix = "LSN";

  let newHouseholds = 0, newMembers = 0, skippedExisting = 0, syntheticHeads = 0, noPhone = 0;
  let seq = maxSeq;
  const plans = [];

  for (const { chuHo, rows: gr } of groups.values()) {
    const headKey = normKey(chuHo);
    let headRow = gr.find((r) => normKey(r.hoTen) === headKey);
    if (!headRow) { headRow = { hoTen: chuHo, sdt: null }; syntheticHeads++; }
    const to = gr.find((r) => r.to)?.to || null;

    const others = gr.filter((r) => r !== headRow);
    const memberList = [
      { hoTen: headRow.hoTen, sdt: headRow.sdt, quanHeChuHo: "Chủ hộ", laChuHo: true },
      ...others.map((r) => ({ hoTen: r.hoTen, sdt: r.sdt, quanHeChuHo: "Không có thông tin", laChuHo: false })),
    ];
    memberList.forEach((m) => { if (!m.sdt) noPhone++; });

    const headEx = findExisting(headRow.hoTen, headRow.sdt);
    const toCreate = memberList.filter((m) => { const ex = findExisting(m.hoTen, m.sdt); if (ex) { skippedExisting++; return false; } return true; });
    if (toCreate.length === 0) continue;

    if (headEx) {
      plans.push({ existingHouseholdId: headEx.householdId, to, members: toCreate.map((m) => ({ ...m, laChuHo: false })) });
      newMembers += toCreate.length;
    } else {
      let mem = toCreate;
      if (!mem.some((m) => m.laChuHo)) mem = mem.map((m, i) => (i === 0 ? { ...m, laChuHo: true, quanHeChuHo: "Chủ hộ" } : m));
      seq += 1;
      plans.push({ soHoKhau: `${prefix}-${pad3(seq)}`, to, members: mem });
      newHouseholds++; newMembers += mem.length;
    }
  }

  console.log(`\n=== KẾ HOẠCH (thôn ${village.ten}, ma ${village.ma}) ===`);
  console.log(`Tổng hộ trong file: ${groups.size}`);
  console.log(`Hộ MỚI sẽ tạo: ${newHouseholds}  (mã ${prefix}-${pad3(maxSeq + 1)} … ${prefix}-${pad3(seq)})`);
  console.log(`Nhân khẩu MỚI sẽ tạo: ${newMembers}`);
  console.log(`Chủ hộ tạo thêm (không có dòng riêng): ${syntheticHeads}`);
  console.log(`Bỏ qua vì đã có (khớp SĐT/tên): ${skippedExisting}`);
  console.log(`Nhân khẩu không SĐT: ${noPhone}  ·  SĐT sai định dạng (để trống): ${badPhone}`);
  if (dupHeadNames.length) console.log(`⚠ ${dupHeadNames.length} tên chủ hộ có nhiều dòng tự-chủ-hộ (có thể là hộ trùng tên bị gộp): ${dupHeadNames.slice(0, 10).join(", ")}${dupHeadNames.length > 10 ? " ..." : ""}`);
  console.log(`\n10 hộ mẫu:`);
  plans.slice(0, 10).forEach((p) => console.log(`  ${p.soHoKhau || "→ hộ có sẵn"} | Tổ ${p.to || "-"} | ${p.members.map((m) => `${m.hoTen}${m.laChuHo ? "(CH)" : ""}${m.sdt ? " " + m.sdt : ""}`).join("; ")}`));

  if (!COMMIT) { console.log(`\n[DRY RUN] Chưa ghi gì vào DB. Thêm --commit để thực hiện.`); await prisma.$disconnect(); return; }

  const touched = new Set();
  await prisma.$transaction(async (tx) => {
    for (const p of plans) {
      if (p.existingHouseholdId) {
        for (const m of p.members) await tx.member.create({ data: { ...normalizeMember(m), householdId: p.existingHouseholdId } });
        touched.add(p.existingHouseholdId);
      } else {
        const diaChi = [p.to, VILLAGE_NAME, "Xã Hòa Tiến"].filter(Boolean).join(", ");
        const hh = await tx.household.create({
          data: { soHoKhau: p.soHoKhau, diaChi, to: p.to, villageId: village.id, loaiHo: "THUONG_TRU", members: { create: p.members.map((m) => normalizeMember(m)) } },
          select: { id: true },
        });
        touched.add(hh.id);
      }
    }
    for (const id of touched) {
      const cnt = await tx.member.count({ where: { householdId: id } });
      await tx.household.update({ where: { id }, data: { soNhanKhau: cnt } });
    }
  }, { timeout: 180000 });

  console.log(`\n✅ Xong: tạo ${newHouseholds} hộ mới + ${newMembers} nhân khẩu mới. Cập nhật ${touched.size} hộ.`);
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
