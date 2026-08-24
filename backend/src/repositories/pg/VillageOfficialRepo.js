const { prisma } = require("../../config/database");

const INCLUDE_VILLAGE = {
  village: { select: { id: true, ten: true, ma: true } },
};

const findAll = ({ villageId, vaiTro } = {}) => {
  const where = {
    ...(villageId && { villageId }),
    ...(vaiTro && { vaiTro }),
  };
  return prisma.villageOfficial.findMany({
    where,
    include: INCLUDE_VILLAGE,
    orderBy: [{ villageId: "asc" }, { thuTu: "asc" }, { createdAt: "asc" }],
  });
};

const findById = (id) =>
  prisma.villageOfficial.findUnique({ where: { id }, include: INCLUDE_VILLAGE });

const create = (data) =>
  prisma.villageOfficial.create({ data, include: INCLUDE_VILLAGE });

const update = (id, data) =>
  prisma.villageOfficial.update({ where: { id }, data, include: INCLUDE_VILLAGE });

const remove = (id) => prisma.villageOfficial.delete({ where: { id } });

module.exports = { findAll, findById, create, update, remove };
