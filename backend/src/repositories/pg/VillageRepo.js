const { prisma } = require("../../config/database");

const findAll = () =>
  prisma.village.findMany({ orderBy: { ma: "asc" } });

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
