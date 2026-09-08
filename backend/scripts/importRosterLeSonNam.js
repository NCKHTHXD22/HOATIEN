// Import roster "Kích hoạt BHYT Lệ Sơn Nam.xlsx" → bổ sung nhân khẩu/hộ vào thôn Lệ Sơn Nam.
// File cột: STT | HỌ TÊN | HỌ TÊN CHỦ HỘ | SĐT | ĐỊA CHỈ | GHI CHÚ (header dòng 1).
// - Nhóm theo BLOCK liên tiếp cùng tên chủ hộ (giữ cấu trúc file); tách hộ mới khi gặp
//   dòng-chủ-hộ thứ 2 cùng tên (trùng tên thật → 2 hộ). GIỮ NGUYÊN DẤU khi so tên
//   (Thanh/Thành/Thạnh là người khác nhau, không được gộp).
// - Chủ hộ không có dòng riêng → tạo bản ghi chủ hộ từ cột CHỦ HỘ.
// - Dedup theo HỌ TÊN (giữ dấu) so với dân hiện có; trùng SĐT-khác-tên vẫn tạo (báo để rà).
// - Không có ngày sinh/CCCD/giới tính trong file → để trống.
// Dry-run mặc định; thêm --commit để ghi thật.
//   node scripts/importRosterLeSonNam.js "<đường dẫn .xlsx>" [--commit]
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
// GIỮ NGUYÊN DẤU (chỉ thường hóa + gộp khoảng trắng) — KHÔNG bỏ dấu để tránh gộp nhầm.
const nameKey = (s) => (s || "").toString().toLowerCase().replace(/\s+/g, " ").trim();

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

  // Nhóm theo BLOCK liên tiếp cùng tên chủ hộ; tách hộ mới khi đổi tên chủ hộ HOẶC
  // gặp dòng-chủ-hộ thứ 2 cùng tên trong cùng block (trùng tên thật → 2 hộ riêng).
  const households = [];
  let cur = null;
  for (const r of rows) {
    const isHead = nameKey(r.hoTen) === nameKey(r.chuHo);
    const changed = !cur || nameKey(r.chuHo) !== cur.chuHoKey || (isHead && cur.hasHead);
    if (changed) { cur = { chuHo: r.chuHo, chuHoKey: nameKey(r.chuHo), rows: [], hasHead: false }; households.push(cur); }
    cur.rows.push(r);
    if (isHead) cur.hasHead = true;
  }
  // Tên chủ hộ trùng đã được tách thành nhiều hộ riêng (đúng, không gộp)
  const cnt = new Map();
  households.forEach((h) => cnt.set(h.chuHoKey, (cnt.get(h.chuHoKey) || 0) + 1));
  const splitDup = [...cnt.entries()].filter(([, c]) => c > 1).map(([k, c]) => `${k} (${c})`);

  const village = await prisma.village.findFirst({ where: { ten: { equals: VILLAGE_NAME, mode: "insensitive" } } });
  if (!village) throw new Error(`Không tìm thấy thôn ${VILLAGE_NAME}`);

  // Dân hiện có của thôn → map dedup (theo họ tên GIỮ DẤU + SĐT)
  const existing = await prisma.member.findMany({
    where: { household: { villageId: village.id } },
    select: { id: true, hoTen: true, sdt: true, householdId: true },
  });
  const byPhone = new Map(); existing.forEach((m) => { if (m.sdt) byPhone.set(m.sdt, m); });
  const byName = new Map(); existing.forEach((m) => { const k = nameKey(m.hoTen); if (!byName.has(k)) byName.set(k, m); });
  const match = (hoTen, sdt) => {
    const n = byName.get(nameKey(hoTen));
    if (n) return { ex: n, reason: "name" };
    if (sdt) { const p = byPhone.get(sdt); if (p) return { ex: p, reason: "phone" }; }
    return null;
  };

  // Prefix + seq từ mã hộ hiện có
  const hhs = await prisma.household.findMany({ where: { villageId: village.id }, select: { soHoKhau: true } });
  let prefix = null, maxSeq = 0;
  for (const h of hhs) { const m = (h.soHoKhau || "").match(/^(.*)-(\d+)$/); if (m) { prefix = prefix || m[1]; maxSeq = Math.max(maxSeq, parseInt(m[2], 10)); } }
  if (!prefix) prefix = "LSN";

  let newHouseholds = 0, newMembers = 0, skippedByName = 0, phoneOnly = 0, syntheticHeads = 0, noPhone = 0;
  const samplesName = [], samplesPhone = [];
  let seq = maxSeq;
  const plans = [];

  for (const { chuHo, rows: gr } of households) {
    const headKey = nameKey(chuHo);
    let headRow = gr.find((r) => nameKey(r.hoTen) === headKey);
    if (!headRow) { headRow = { hoTen: chuHo, sdt: null }; syntheticHeads++; }
    const to = gr.find((r) => r.to)?.to || null;

    const others = gr.filter((r) => r !== headRow);
    const memberList = [
      { hoTen: headRow.hoTen, sdt: headRow.sdt, quanHeChuHo: "Chủ hộ", laChuHo: true },
      ...others.map((r) => ({ hoTen: r.hoTen, sdt: r.sdt, quanHeChuHo: "Không có thông tin", laChuHo: false })),
    ];
    memberList.forEach((m) => { if (!m.sdt) noPhone++; });

    const headM = match(headRow.hoTen, headRow.sdt);
    const headEx = headM && headM.reason === "name" ? headM.ex : null;
    const toCreate = [];
    for (const m of memberList) {
      const mm = match(m.hoTen, m.sdt);
      if (mm && mm.reason === "name") { skippedByName++; if (samplesName.length < 10) samplesName.push(`${m.hoTen} → đã có: ${mm.ex.hoTen}`); continue; }
      if (mm && mm.reason === "phone") { phoneOnly++; if (samplesPhone.length < 10) samplesPhone.push(`${m.hoTen}${m.sdt ? " " + m.sdt : ""} ~trùng SĐT với~ ${mm.ex.hoTen}`); }
      toCreate.push(m);
    }
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
  console.log(`Tổng hộ trong file: ${households.length}`);
  console.log(`Hộ MỚI sẽ tạo: ${newHouseholds}  (mã ${prefix}-${pad3(maxSeq + 1)} … ${prefix}-${pad3(seq)})`);
  console.log(`Nhân khẩu MỚI sẽ tạo: ${newMembers}`);
  console.log(`Chủ hộ tạo thêm (không có dòng riêng): ${syntheticHeads}`);
  console.log(`Bỏ qua vì TRÙNG TÊN người đã có: ${skippedByName}`);
  console.log(`Nhân khẩu không SĐT: ${noPhone}  ·  SĐT sai định dạng (để trống): ${badPhone}`);
  if (splitDup.length) console.log(`✔ ${splitDup.length} tên chủ hộ TRÙNG đã tách thành hộ riêng (đúng): ${splitDup.slice(0, 10).join(", ")}${splitDup.length > 10 ? " ..." : ""}`);
  if (phoneOnly) console.log(`⚠ ${phoneOnly} người TRÙNG SĐT nhưng khác tên (VẪN TẠO — có thể chung SĐT gia đình):\n   ${samplesPhone.join("\n   ")}`);
  if (samplesName.length) console.log(`\nMẫu bỏ qua do trùng tên (kiểm nếu nghi trùng tên KHÁC người):\n   ${samplesName.join("\n   ")}`);
  console.log(`\n10 hộ mẫu sẽ tạo:`);
  plans.slice(0, 10).forEach((p) => console.log(`  ${p.soHoKhau || "→ hộ có sẵn"} | ${p.to || "(chưa rõ tổ)"} | ${p.members.map((m) => `${m.hoTen}${m.laChuHo ? "(CH)" : ""}${m.sdt ? " " + m.sdt : ""}`).join("; ")}`));

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
      const c = await tx.member.count({ where: { householdId: id } });
      await tx.household.update({ where: { id }, data: { soNhanKhau: c } });
    }
  }, { timeout: 180000 });

  console.log(`\n✅ Xong: tạo ${newHouseholds} hộ mới + ${newMembers} nhân khẩu mới. Cập nhật ${touched.size} hộ.`);
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
