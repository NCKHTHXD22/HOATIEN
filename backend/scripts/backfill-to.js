const { prisma } = require("../src/config/database");

async function main() {
  const households = await prisma.household.findMany({
    where: { to: null },
    select: { id: true, soHoKhau: true, diaChi: true },
  });

  let matched = 0;
  let skipped = 0;

  for (const h of households) {
    const m = h.diaChi.match(/Tổ\s*(\d+)/i);
    if (m) {
      await prisma.household.update({ where: { id: h.id }, data: { to: `Tổ ${m[1]}` } });
      matched++;
    } else {
      skipped++;
    }
  }

  console.log(`Tổng số hộ kiểm tra: ${households.length}`);
  console.log(`Đã gán Tổ: ${matched}`);
  console.log(`Không tìm thấy Tổ trong địa chỉ: ${skipped}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
