const { prisma } = require("../../config/database");

const INCLUDE_FULL = {
  village: { select: { id: true, ten: true, ma: true } },
  members: true,
};

const findAll = ({ villageId, trangThai, loaiHo, to, page = 1, limit = 20 } = {}) => {
  const where = {
    ...(villageId && { villageId }),
    ...(trangThai && { trangThai }),
    ...(loaiHo && { loaiHo }),
    ...(to && { to }),
  };
  const skip = (page - 1) * limit;
  return Promise.all([
    prisma.household.findMany({ where, include: INCLUDE_FULL, skip, take: parseInt(limit), orderBy: { createdAt: "desc" } }),
    prisma.household.count({ where }),
  ]);
};

const findDistinctTo = async (villageId) => {
  const rows = await prisma.household.findMany({
    where: { ...(villageId && { villageId }), to: { not: null } },
    select: { to: true },
    distinct: ["to"],
  });
  return rows
    .map((r) => r.to)
    .filter(Boolean)
    .sort((a, b) => {
      const na = parseInt(a.match(/\d+/)?.[0] ?? "0", 10);
      const nb = parseInt(b.match(/\d+/)?.[0] ?? "0", 10);
      return na - nb || a.localeCompare(b);
    });
};

const findById = (id) =>
  prisma.household.findUnique({ where: { id }, include: INCLUDE_FULL });

const findBySoHoKhau = (soHoKhau) =>
  prisma.household.findUnique({ where: { soHoKhau }, include: INCLUDE_FULL });

const findByIds = (ids) =>
  prisma.household.findMany({ where: { id: { in: ids } }, include: INCLUDE_FULL });

const create = (data, members = []) =>
  prisma.household.create({
    data: {
      ...data,
      members: members.length ? { create: members } : undefined,
    },
    include: INCLUDE_FULL,
  });

const update = (id, data) =>
  prisma.household.update({ where: { id }, data, include: INCLUDE_FULL });

const remove = (id) => prisma.household.delete({ where: { id } });

module.exports = { findAll, findDistinctTo, findById, findBySoHoKhau, findByIds, create, update, remove };
