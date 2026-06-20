const { prisma } = require("../../config/database");

const INCLUDE = {
  household: { select: { id: true, soHoKhau: true, diaChi: true, village: { select: { id: true, ten: true } } } },
  performedBy: { select: { id: true, hoTen: true } },
};

const findAll = ({ householdId, villageId, loai, fromDate, toDate, page = 1, limit = 20 } = {}) => {
  const where = {
    ...(householdId && { householdId }),
    ...(villageId && { household: { villageId } }),
    ...(loai && { loai }),
    ...((fromDate || toDate) && {
      ngay: {
        ...(fromDate && { gte: new Date(fromDate) }),
        ...(toDate && { lte: new Date(toDate) }),
      },
    }),
  };
  const skip = (page - 1) * limit;
  return Promise.all([
    prisma.movementRecord.findMany({
      where,
      include: INCLUDE,
      skip,
      take: parseInt(limit),
      orderBy: { ngay: "desc" },
    }),
    prisma.movementRecord.count({ where }),
  ]);
};

const findById = (id) =>
  prisma.movementRecord.findUnique({ where: { id }, include: INCLUDE });

const create = (data) =>
  prisma.movementRecord.create({ data, include: INCLUDE });

const update = (id, data) =>
  prisma.movementRecord.update({ where: { id }, data, include: INCLUDE });

const remove = (id) =>
  prisma.movementRecord.delete({ where: { id } });

module.exports = { findAll, findById, create, update, remove };
