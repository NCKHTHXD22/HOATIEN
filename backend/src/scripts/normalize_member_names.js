// Chuẩn hóa họ tên nhân khẩu cũ về dạng chuẩn "Nguyễn Văn A".
// - Chỉ chuẩn hóa các bản ghi TRÔNG NHƯ TÊN NGƯỜI.
// - Bản ghi KHÔNG giống tên (dòng thống kê/tiêu đề Excel nhập nhầm) → chỉ liệt kê, KHÔNG sửa.
// Dry-run mặc định; chạy thật: node src/scripts/normalize_member_names.js --apply
require("dotenv").config();
const { prisma } = require("../config/database");
const { toProperName } = require("../utils/normalize");

const APPLY = process.argv.includes("--apply");

// Nhận diện đâu là tên người thật (loại bỏ dòng rác import)
function isLikelyName(s) {
  const t = (s || "").trim();
  if (!t) return false;
  if (/[0-9:]/.test(t)) return false; // có số hoặc dấu ":"
  if (/^[-•*.]/.test(t)) return false; // gạch đầu dòng
  if (t.length > 35) return false; // quá dài so với tên
  if (t.split(/\s+/).length > 6) return false; // quá nhiều từ
  if (/tổng số|bảng|thống kê|độ tuổi|tài khoản|nền tảng|dịch vụ|gia đình có|sử dụng/iu.test(t)) return false;
  return true;
}

(async () => {
  const members = await prisma.member.findMany({ select: { id: true, hoTen: true } });
  const changes = [];
  const junk = [];
  for (const m of members) {
    if (!isLikelyName(m.hoTen)) { junk.push(m.hoTen); continue; }
    const proper = toProperName(m.hoTen || "");
    if (proper && proper !== m.hoTen) changes.push({ id: m.id, from: m.hoTen, to: proper });
  }

  console.log(`Tổng ${members.length} nhân khẩu`);
  console.log(`• Tên thật cần chuẩn hóa: ${changes.length}`);
  changes.slice(0, 20).forEach((c) => console.log(`   "${c.from}" → "${c.to}"`));
  if (changes.length > 20) console.log(`   ... và ${changes.length - 20} tên khác`);
  console.log(`• Bản ghi KHÔNG phải tên (rác import, cần xử lý riêng): ${junk.length}`);
  junk.slice(0, 15).forEach((j) => console.log(`   ⚠ "${j}"`));
  if (junk.length > 15) console.log(`   ... và ${junk.length - 15} dòng khác`);

  if (!APPLY) {
    console.log("\n(DRY-RUN — thêm --apply để cập nhật tên thật; KHÔNG đụng dòng rác)");
  } else {
    for (const c of changes) {
      await prisma.member.update({ where: { id: c.id }, data: { hoTen: c.to } });
    }
    console.log(`\n✅ Đã chuẩn hóa ${changes.length} tên. (Dòng rác giữ nguyên, chờ bạn quyết định)`);
  }
  await prisma.$disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
