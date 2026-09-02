// Chuẩn hóa họ tên nhân khẩu cũ về dạng chuẩn "Nguyễn Văn A".
// Dry-run mặc định (chỉ liệt kê); chạy thật: node src/scripts/normalize_member_names.js --apply
require("dotenv").config();
const { prisma } = require("../config/database");
const { toProperName } = require("../utils/normalize");

const APPLY = process.argv.includes("--apply");

(async () => {
  const members = await prisma.member.findMany({ select: { id: true, hoTen: true } });
  const changes = [];
  for (const m of members) {
    const proper = toProperName(m.hoTen || "");
    if (proper && proper !== m.hoTen) changes.push({ id: m.id, from: m.hoTen, to: proper });
  }

  console.log(`Tổng ${members.length} nhân khẩu · cần chuẩn hóa: ${changes.length}`);
  changes.slice(0, 15).forEach((c) => console.log(`  "${c.from}" → "${c.to}"`));
  if (changes.length > 15) console.log(`  ... và ${changes.length - 15} tên khác`);

  if (!APPLY) {
    console.log("\n(DRY-RUN — thêm --apply để cập nhật thật)");
  } else {
    for (const c of changes) {
      await prisma.member.update({ where: { id: c.id }, data: { hoTen: c.to } });
    }
    console.log(`\n✅ Đã cập nhật ${changes.length} tên.`);
  }
  await prisma.$disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
