// Chuẩn hóa cột Household.to (Tổ) — dữ liệu nhập từ nhiều đợt import Excel khác nhau nên
// bị lẫn nhiều biến thể của cùng 1 tổ ("tổ 1"/"Tổ 1"/"Tổ 01", "6" thiếu chữ "Tổ"...).
// Gộp về đúng 1 dạng chuẩn "Tổ N" (không số 0 đầu) cho N từ 1-11.
// Mặc định dry-run. Thêm --commit để ghi thật.
//   node scripts/normalizeHouseholdTo.js
//   node scripts/normalizeHouseholdTo.js --commit
require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const COMMIT = process.argv.includes("--commit");

function canonicalTo(raw) {
  const s = (raw || "").toString().trim();
  if (!s) return null;
  const m = s.match(/(\d+)/);
  if (!m) return null; // không có số → không đụng vào, để cảnh báo riêng
  const n = parseInt(m[1], 10);
  if (!(n >= 1 && n <= 11)) return null; // ngoài phạm vi tổ 1-11 → không tự sửa, cần xem tay
  return `Tổ ${n}`;
}

async function main() {
  const groups = await prisma.household.groupBy({ by: ["to"], _count: { _all: true } });
  const nonNull = groups.filter((g) => g.to !== null);

  const plan = []; // { from, to, count }
  const unresolved = [];
  for (const g of nonNull) {
    const canon = canonicalTo(g.to);
    if (!canon) { unresolved.push({ value: g.to, count: g._count._all }); continue; }
    if (canon !== g.to) plan.push({ from: g.to, to: canon, count: g._count._all });
  }

  console.log(`Tổng ${nonNull.length} giá trị "to" khác nhau đang có trong DB (khác null).`);
  console.log(`${plan.length} giá trị cần chuẩn hóa lại:`);
  plan.sort((a, b) => a.to.localeCompare(b.to, "vi") || a.from.localeCompare(b.from, "vi"));
  plan.forEach((p) => console.log(`  "${p.from}" (${p.count} hộ) → "${p.to}"`));

  if (unresolved.length) {
    console.log(`\n⚠ ${unresolved.length} giá trị KHÔNG tự sửa được (không phải tổ 1-11, cần xem tay):`);
    unresolved.forEach((u) => console.log(`  "${u.value}" (${u.count} hộ)`));
  }

  if (!COMMIT) {
    console.log(`\n[DRY RUN] Chưa ghi gì vào DB. Chạy lại kèm --commit để cập nhật ${plan.reduce((s, p) => s + p.count, 0)} hộ.`);
    return;
  }

  let updated = 0;
  for (const p of plan) {
    const res = await prisma.household.updateMany({ where: { to: p.from }, data: { to: p.to } });
    updated += res.count;
    console.log(`✔ "${p.from}" → "${p.to}": cập nhật ${res.count} hộ`);
  }
  console.log(`\nHoàn tất — đã chuẩn hóa ${updated} hộ.`);
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
