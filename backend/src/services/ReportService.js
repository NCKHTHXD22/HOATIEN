const { prisma } = require("../config/database");
const ReportCacheRepo = require("../repositories/mongo/ReportCacheRepo");

async function getStatsByVillage() {
  const cacheKey = "stats_by_village";
  const cached = await ReportCacheRepo.get(cacheKey);
  if (cached) return cached.data;

  const stats = await prisma.village.findMany({
    include: {
      _count: { select: { households: true } },
      households: {
        select: {
          trangThai: true,
          loaiHo: true,
          _count: { select: { members: true } },
        },
      },
    },
  });

  const data = stats.map((v) => ({
    villageId: v.id, villageName: v.ten, ma: v.ma,
    totalHouseholds: v._count.households,
    activeHouseholds: v.households.filter((h) => h.trangThai === "ACTIVE").length,
    totalMembers: v.households.reduce((sum, h) => sum + h._count.members, 0),
    byType: {
      THUONG_TRU: v.households.filter((h) => h.loaiHo === "THUONG_TRU").length,
      TAM_TRU: v.households.filter((h) => h.loaiHo === "TAM_TRU").length,
      TAM_VANG: v.households.filter((h) => h.loaiHo === "TAM_VANG").length,
    },
  }));

  await ReportCacheRepo.set(cacheKey, data, 3600);
  return data;
}

async function getMovementStats({ fromDate, toDate } = {}) {
  const where = fromDate && toDate
    ? { ngay: { gte: new Date(fromDate), lte: new Date(toDate) } }
    : {};

  const [moveIn, moveOut] = await Promise.all([
    prisma.movementRecord.count({ where: { ...where, loai: "MOVE_IN" } }),
    prisma.movementRecord.count({ where: { ...where, loai: "MOVE_OUT" } }),
  ]);

  return { moveIn, moveOut, net: moveIn - moveOut };
}

async function getTotalSummary() {
  const cacheKey = "total_summary";
  const cached = await ReportCacheRepo.get(cacheKey);
  if (cached) return cached.data;

  const [households, members, villages] = await Promise.all([
    prisma.household.count({ where: { trangThai: "ACTIVE" } }),
    prisma.member.count({ where: { trangThai: "ACTIVE" } }),
    prisma.village.count(),
  ]);

  const data = { households, members, villages, updatedAt: new Date() };
  await ReportCacheRepo.set(cacheKey, data, 1800);
  return data;
}

module.exports = { getStatsByVillage, getMovementStats, getTotalSummary };
