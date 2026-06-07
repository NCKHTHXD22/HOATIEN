const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  const villages = await Promise.all([
    prisma.village.upsert({
      where: { ma: "THON_1" },
      update: {},
      create: { ma: "THON_1", ten: "Thôn 1", truongThon: "Nguyễn Văn A" },
    }),
    prisma.village.upsert({
      where: { ma: "THON_2" },
      update: {},
      create: { ma: "THON_2", ten: "Thôn 2", truongThon: "Trần Thị B" },
    }),
    prisma.village.upsert({
      where: { ma: "THON_3" },
      update: {},
      create: { ma: "THON_3", ten: "Thôn 3", truongThon: "Lê Văn C" },
    }),
  ]);

  const hash = await bcrypt.hash("admin123", 10);
  await prisma.adminUser.upsert({
    where: { username: "superadmin" },
    update: {},
    create: {
      username: "superadmin",
      passwordHash: hash,
      hoTen: "Super Admin",
      role: "SUPER_ADMIN",
      villages: { connect: villages.map((v) => ({ id: v.id })) },
    },
  });

  console.log("Seed completed:", villages.length, "thôn,", "1 superadmin");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
