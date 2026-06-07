const { prisma } = require("../../config/database");

const INCLUDE_FULL = {
  village: { select: { id: true, ten: true, ma: true } },
  members: true,
};

const findAll = ({ villageId, trangThai, loaiHo, page = 1, limit = 20 } = {}) => {
  const where = {
    ...(villageId && { villageId }),
    ...(trangThai && { trangThai }),
    ...(loaiHo && { loaiHo }),
  };
  const skip = (page - 1) * limit;
  return Promise.all([
    prisma.household.findMany({ where, include: INCLUDE_FULL, skip, take: parseInt(limit), orderBy: { createdAt: "desc" } }),
    prisma.household.count({ where }),
  ]);
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

module.exports = { findAll, findById, findBySoHoKhau, findByIds, create, update, remove };
