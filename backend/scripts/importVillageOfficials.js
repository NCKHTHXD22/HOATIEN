// Import "Danh sách Tổ CNSCĐ" (ban lãnh đạo thôn) từ file Excel vào bảng village_officials.
// Mặc định chạy dry-run (chỉ xem trước, không ghi DB). Thêm --commit để ghi thật.
//   node scripts/importVillageOfficials.js "../Documents/danh sách tổ CNSCĐ.xlsx"
//   node scripts/importVillageOfficials.js "../Documents/danh sách tổ CNSCĐ.xlsx" --commit
require("dotenv").config();
const path = require("path");
const xlsx = require("xlsx");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const args = process.argv.slice(2).filter((a) => a !== "--commit");
const COMMIT = process.argv.includes("--commit");
const EXCEL_PATH = path.resolve(args[0] || path.join(__dirname, "../../Documents/danh sách tổ CNSCĐ.xlsx"));

const VAI_TRO_MAP = { "Tổ trưởng": "TO_TRUONG", "Tổ phó": "TO_PHO", "Thành viên": "THANH_VIEN" };

function normalize(s) {
  return (s || "")
    .toString()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/^thon\s+/, "")
    .replace(/[^a-z0-9]/g, "");
}

function extractVillageName(groupLabel) {
  return groupLabel
    .toString()
    .replace(/^T[ổo]\s*CNSC[ĐD]\s*/i, "")
    .replace(/\s*-\s*H[òo]a\s*Ti[ếe]n\s*$/i, "")
    .trim();
}

function parseGroups(rows) {
  const [, ...data] = rows;
  const groups = [];
  let current = null;
  for (const row of data) {
    const [, tenTo, hoTen, chucDanh, vaiTroRaw, sdt, ghiChu] = row;
    if (tenTo) {
      current = { villageName: extractVillageName(tenTo), rows: [] };
      groups.push(current);
    }
    if (!hoTen || !current) continue;
    groups[groups.length - 1].rows.push({
      hoTen: hoTen.toString().trim(),
      chucDanh: (chucDanh || "").toString().trim(),
      vaiTro: VAI_TRO_MAP[vaiTroRaw] || "THANH_VIEN",
      sdt: sdt ? sdt.toString().trim() : null,
      ghiChu: ghiChu ? ghiChu.toString().trim() : null,
    });
  }
  return groups;
}

async function main() {
  console.log(`Đọc file: ${EXCEL_PATH}`);
  const wb = xlsx.readFile(EXCEL_PATH);
  const ws = wb.Sheets["Sheet1"];
  const rows = xlsx.utils.sheet_to_json(ws, { header: 1, defval: "" });
  const groups = parseGroups(rows);

  const villages = await prisma.village.findMany();
  const villageByNorm = new Map(villages.map((v) => [normalize(v.ten), v]));

  const plan = [];
  const unmatched = [];
  for (const g of groups) {
    const village = villageByNorm.get(normalize(g.villageName));
    if (!village) { unmatched.push(g.villageName); continue; }
    plan.push({ village, rows: g.rows });
  }

  console.log(`\nĐọc được ${groups.length} thôn / ${groups.reduce((s, g) => s + g.rows.length, 0)} cán bộ từ file.`);
  console.log(`Khớp được ${plan.length}/${groups.length} thôn với dữ liệu hiện có trong DB (${villages.length} thôn).`);
  if (unmatched.length) {
    console.log(`\n⚠ Không khớp được với thôn nào trong DB (sẽ BỎ QUA, không tự tạo thôn mới):`);
    unmatched.forEach((n) => console.log(`  - "${n}"`));
  }

  console.log(`\n${COMMIT ? "GHI DỮ LIỆU:" : "[DRY RUN] Xem trước (chạy lại kèm --commit để ghi thật):"}`);
  for (const p of plan) {
    const truong = p.rows.find((r) => r.vaiTro === "TO_TRUONG");
    console.log(`  - ${p.village.ten}: ${p.rows.length} cán bộ${truong ? ` (Trưởng thôn: ${truong.hoTen})` : ""}`);
  }

  if (!COMMIT) return;

  for (const p of plan) {
    await prisma.$transaction(async (tx) => {
      await tx.villageOfficial.deleteMany({ where: { villageId: p.village.id } });
      await tx.villageOfficial.createMany({
        data: p.rows.map((r, i) => ({
          villageId: p.village.id,
          hoTen: r.hoTen,
          chucDanh: r.chucDanh,
          vaiTro: r.vaiTro,
          sdt: r.sdt,
          ghiChu: r.ghiChu,
          thuTu: i,
        })),
      });
      const truong = p.rows.find((r) => r.vaiTro === "TO_TRUONG");
      if (truong) {
        await tx.village.update({ where: { id: p.village.id }, data: { truongThon: truong.hoTen } });
      }
    });
    console.log(`✔ Đã cập nhật thôn ${p.village.ten}`);
  }
  console.log("\nHoàn tất import.");
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
