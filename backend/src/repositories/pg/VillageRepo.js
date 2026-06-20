const { prisma } = require("../../config/database");

const findAll = async () => {
  const villages = await prisma.village.findMany({
    orderBy: { ma: "asc" },
    include: {
      _count: { select: { households: true } },
      households: { select: { _count: { select: { members: true } } } },
    },
  });
  // Dân số = tổng nhân khẩu của các hộ trong thôn (Member không gắn trực tiếp Village)
  return villages.map(({ households, _count, ...v }) => ({
    ...v,
    _count: {
      households: _count.households,
      members: households.reduce((sum, h) => sum + h._count.members, 0),
    },
  }));
};

const findById = (id) =>
  prisma.village.findUnique({ where: { id }, include: { _count: { select: { households: true } } } });

const findByMa = (ma) =>
  prisma.village.findUnique({ where: { ma } });

const create = (data) =>
  prisma.village.create({ data });

const update = (id, data) =>
  prisma.village.update({ where: { id }, data });

const remove = (id) =>
  prisma.village.delete({ where: { id } });

module.exports = { findAll, findById, findByMa, create, update, remove };
