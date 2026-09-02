// Dọn bản ghi RÁC trong bảng members (do import Excel nhầm):
// - "TT: <tên>"  → bỏ tiền tố, giữ tên chuẩn hóa
// - dòng tiêu đề/thống kê/số lạc → XOÁ (xử lý FK notification_sends như MemberService.remove)
// Dry-run mặc định; chạy thật: node src/scripts/cleanup_member_junk.js --apply
require("dotenv").config();
const { prisma } = require("../config/database");
const { toProperName } = require("../utils/normalize");
const APPLY = process.argv.includes("--apply");

function isLikelyName(s) {
  const t = (s || "").trim();
  if (!t) return false;
  if (/[0-9:]/.test(t)) return false;
  if (/^[-•*.]/.test(t)) return false;
  if (t.length > 35) return false;
  if (t.split(/\s+/).length > 6) return false;
  if (/tổng số|bảng|thống kê|độ tuổi|tài khoản|nền tảng|dịch vụ|gia đình có|sử dụng/iu.test(t)) return false;
  return true;
}

(async () => {
  const members = await prisma.member.findMany({ select: { id: true, hoTen: true, laChuHo: true, householdId: true } });
  const toFix = [];
  const toDelete = [];
  for (const m of members) {
    if (isLikelyName(m.hoTen)) continue;
    const t = (m.hoTen || "").trim();
    const mt = t.match(/^TT\s*:\s*(.+)$/i);
    if (mt) toFix.push({ id: m.id, from: t, to: toProperName(mt[1]) });
    else toDelete.push({ id: m.id, hoTen: t, laChuHo: m.laChuHo });
  }

  console.log(`• Bỏ tiền tố "TT:": ${toFix.length}`);
  toFix.forEach((c) => console.log(`   "${c.from}" → "${c.to}"`));
  console.log(`• XOÁ dòng rác: ${toDelete.length}`);
  toDelete.forEach((c) => console.log(`   ✗ "${c.hoTen}"${c.laChuHo ? "  ⚠(là chủ hộ → hộ sẽ rỗng)" : ""}`));

  if (!APPLY) {
    console.log("\n(DRY-RUN — thêm --apply để thực hiện)");
  } else {
    for (const c of toFix) await prisma.member.update({ where: { id: c.id }, data: { hoTen: c.to } });
    for (const c of toDelete) {
      await prisma.$transaction(async (tx) => {
        await tx.notificationSend.deleteMany({ where: { memberId: c.id } });
        await tx.member.delete({ where: { id: c.id } });
      });
    }
    console.log(`\n✅ Đã bỏ "TT:" cho ${toFix.length}, xoá ${toDelete.length} dòng rác.`);
  }
  await prisma.$disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
