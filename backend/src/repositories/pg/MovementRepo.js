const { prisma } = require("../../config/database");

const findAll = ({ householdId, loai, fromDate, toDate, page = 1, limit = 20 } = {}) => {
  const where = {
    ...(householdId && { householdId }),
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
      include: {
        household: { select: { id: true, soHoKhau: true, diaChi: true } },
        performedBy: { select: { id: true, hoTen: true } },
      },
      skip,
      take: parseInt(limit),
      orderBy: { ngay: "desc" },
    }),
    prisma.movementRecord.count({ where }),
  ]);
};

const create = (data) =>
  prisma.movementRecord.create({
    data,
    include: {
      household: { select: { id: true, soHoKhau: true } },
      performedBy: { select: { id: true, hoTen: true } },
    },
  });

module.exports = { findAll, create };
