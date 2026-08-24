// Import "danh sách tổ CNSCĐ.xlsx" (Họ và tên | Số điện thoại | ĐỊA CHỈ) trực tiếp vào
// Hộ khẩu/Nhân khẩu (hồ sơ dân cư). Với mỗi người trong file:
//   - Nếu đã có Member cùng SĐT trong DB → coi như đã có hồ sơ, bỏ qua (không tạo trùng).
//   - Nếu chưa có → tạo 1 hộ mới (họ làm chủ hộ), các trường không có trong file (CCCD,
//     ngày sinh, giới tính...) để trống.
// Mặc định dry-run (chỉ xem trước). Thêm --commit để ghi thật.
//   node scripts/importCnscdToHouseholds.js "../Documents/danh sách tổ CNSCĐ.xlsx"
//   node scripts/importCnscdToHouseholds.js "../Documents/danh sách tổ CNSCĐ.xlsx" --commit
require("dotenv").config();
const path = require("path");
const xlsx = require("xlsx");
const { PrismaClient } = require("@prisma/client");
const { normalizeMember } = require("../src/utils/normalize");

const prisma = new PrismaClient();

const args = process.argv.slice(2).filter((a) => a !== "--commit");
const COMMIT = process.argv.includes("--commit");
const EXCEL_PATH = path.resolve(args[0] || path.join(__dirname, "../../Documents/danh sách tổ CNSCĐ.xlsx"));

function normalize(s) {
  return (s || "")
    .toString()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/^thon\s+/, "")
    .replace(/[^a-z0-9]/g, "");
}

// Excel lưu SĐT dạng số → mất số 0 đầu (905280945). Số di động VN chuẩn có 10 số, bắt đầu bằng 0.
function normalizePhone(raw) {
  if (raw == null || raw === "") return null;
  let s = String(raw).trim();
  if (/^\d{9}$/.test(s)) s = "0" + s;
  return s;
}

function findColumns(header) {
  const norm = header.map((h) => normalize(h));
  const hoTenIdx = norm.findIndex((h) => h.includes("hovaten") || h.includes("hoten"));
  const sdtIdx = norm.findIndex((h) => h.includes("dienthoai") || h === "sdt");
  const diaChiIdx = norm.findIndex((h) => h.includes("diachi") || h.includes("thon"));
  if (hoTenIdx === -1 || sdtIdx === -1 || diaChiIdx === -1) {
    throw new Error(`Không dò được cột trong file (header: ${JSON.stringify(header)})`);
  }
  return { hoTenIdx, sdtIdx, diaChiIdx };
}

function parseRows(rows) {
  const [header, ...data] = rows;
  const { hoTenIdx, sdtIdx, diaChiIdx } = findColumns(header);
  const out = [];
  for (const row of data) {
    const hoTen = (row[hoTenIdx] ?? "").toString().trim();
    if (!hoTen) continue;
    out.push({
      hoTen,
      sdt: normalizePhone(row[sdtIdx]),
      villageName: (row[diaChiIdx] ?? "").toString().trim(),
    });
  }
  return out;
}

async function main() {
  console.log(`Đọc file: ${EXCEL_PATH}`);
  const wb = xlsx.readFile(EXCEL_PATH);
  const sheetName = wb.SheetNames.find((n) => xlsx.utils.sheet_to_json(wb.Sheets[n], { header: 1 }).length > 1) || wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const rows = xlsx.utils.sheet_to_json(ws, { header: 1, defval: "" });
  const people = parseRows(rows);

  console.log(`Đọc sheet "${sheetName}": ${people.length} người.`);

  const villages = await prisma.village.findMany();
  const villageByNorm = new Map(villages.map((v) => [normalize(v.ten), v]));

  const unmatchedVillages = new Set();
  const withVillage = [];
  for (const p of people) {
    const village = villageByNorm.get(normalize(p.villageName));
    if (!village) { unmatchedVillages.add(p.villageName); continue; }
    withVillage.push({ ...p, village });
  }

  console.log(`Khớp được thôn cho ${withVillage.length}/${people.length} người (${villages.length} thôn hiện có trong DB).`);
  if (unmatchedVillages.size) {
    console.log(`⚠ Không khớp được thôn (bỏ qua): ${[...unmatchedVillages].join(", ")}`);
  }

  // Nạp toàn bộ SĐT nhân khẩu hiện có để đối chiếu — tránh tạo trùng người đã có hồ sơ
  const existingMembers = await prisma.member.findMany({ where: { sdt: { not: null } }, select: { id: true, hoTen: true, sdt: true } });
  const bySdt = new Map(existingMembers.map((m) => [m.sdt, m]));

  const toCreate = [];
  const alreadyExists = [];
  const noPhone = [];
  for (const p of withVillage) {
    if (!p.sdt) { noPhone.push(p.hoTen); continue; }
    const ex = bySdt.get(p.sdt);
    if (ex) alreadyExists.push({ hoTen: p.hoTen, sdt: p.sdt, existingName: ex.hoTen });
    else toCreate.push(p);
  }

  console.log(`\nTổng ${people.length} người:`);
  console.log(`  - ${alreadyExists.length} người đã có sẵn trong hồ sơ dân cư (khớp theo SĐT) → BỎ QUA, không tạo trùng`);
  console.log(`  - ${toCreate.length} người CHƯA có hồ sơ → sẽ tạo hộ mới (làm chủ hộ, để trống CCCD/ngày sinh/giới tính)`);
  if (noPhone.length) console.log(`  - ${noPhone.length} người không có SĐT trong file (bỏ qua): ${noPhone.join(", ")}`);

  if (alreadyExists.length) {
    console.log(`\nMẫu người đã có sẵn (tối đa 10):`);
    alreadyExists.slice(0, 10).forEach((a) => console.log(`  - ${a.hoTen} (${a.sdt}) → trùng với hồ sơ đã có: ${a.existingName}`));
  }

  if (!COMMIT) {
    console.log(`\n[DRY RUN] Chưa ghi gì vào DB. Chạy lại kèm --commit để tạo ${toCreate.length} hộ mới.`);
    return;
  }

  const pad3 = (n) => String(n).padStart(3, "0");
  let created = 0;
  const byVillage = new Map();
  for (const c of toCreate) {
    if (!byVillage.has(c.village.id)) byVillage.set(c.village.id, []);
    byVillage.get(c.village.id).push(c);
  }

  for (const [villageId, peopleInVillage] of byVillage) {
    const village = peopleInVillage[0].village;
    const prefix = `${village.ma}-CB`;
    let seq = await prisma.household.count({ where: { villageId, soHoKhau: { startsWith: prefix + "-" } } });
    for (const p of peopleInVillage) {
      seq += 1;
      const soHoKhau = `${prefix}-${pad3(seq)}`;
      const member = normalizeMember({ hoTen: p.hoTen, sdt: p.sdt, quanHeChuHo: "Chủ hộ", laChuHo: true });
      await prisma.household.create({
        data: {
          soHoKhau,
          diaChi: village.ten,
          villageId,
          loaiHo: "THUONG_TRU",
          soNhanKhau: 1,
          members: { create: member },
        },
      });
      created++;
    }
    console.log(`✔ ${village.ten}: tạo ${peopleInVillage.length} hộ mới`);
  }

  console.log(`\nHoàn tất — đã tạo ${created} hộ dân mới.`);
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
