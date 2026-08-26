const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function generateVillageAcronym(villageName) {
  if (!villageName) return "HK";
  const name = villageName.replace(/^Thôn\s+/i, '').trim();
  const deaccent = str => String(str).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D");
  return name.split(/\s+/).map(word => deaccent(word)[0].toUpperCase()).join('');
}

async function main() {
  const villages = await prisma.village.findMany({ orderBy: { ten: 'asc' } });
  let totalUpdated = 0;

  // Bước 1: Đổi tất cả sang mã tạm thời trên toàn bộ database để tránh lỗi trùng mã chéo giữa các thôn
  console.log("Đang đổi tất cả mã hiện tại sang mã tạm thời...");
  const allHouseholds = await prisma.household.findMany({ select: { id: true } });
  for (const hh of allHouseholds) {
    await prisma.household.update({
      where: { id: hh.id },
      data: { soHoKhau: `TMP-${hh.id}` }
    });
  }
  
  for (const village of villages) {
    const prefix = generateVillageAcronym(village.ten);
    console.log(`\nĐang đồng bộ Thôn: ${village.ten} (Tiền tố: ${prefix})`);
    
    const households = await prisma.household.findMany({
      where: { villageId: village.id },
      orderBy: { createdAt: 'asc' }
    });
    
    console.log(` - Tìm thấy ${households.length} hộ khẩu`);
    if (households.length === 0) continue;
    
    // Bước 2: Đánh số lại chuẩn từ 1
    let seq = 1;
    for (const hh of households) {
      const targetCode = `${prefix}-${String(seq).padStart(3, '0')}`;
      await prisma.household.update({
        where: { id: hh.id },
        data: { soHoKhau: targetCode }
      });
      totalUpdated++;
      seq++;
    }
  }
  
  console.log(`\nHoàn thành! Đã cập nhật (đồng bộ) tổng cộng ${totalUpdated} mã Hộ khẩu.`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
