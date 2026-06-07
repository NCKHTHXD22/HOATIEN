const { prisma } = require("../../config/database");

const findAll = (filters = {}) =>
  prisma.adminUser.findMany({
    where: filters,
    include: { villages: { select: { id: true, ten: true, ma: true } } },
    orderBy: { createdAt: "desc" },
  });

const findById = (id) =>
  prisma.adminUser.findUnique({
    where: { id },
    include: { villages: { select: { id: true, ten: true, ma: true } } },
  });

const findByUsername = (username) =>
  prisma.adminUser.findUnique({ where: { username } });

const findByZaloUserId = (zaloUserId) =>
  prisma.adminUser.findUnique({ where: { zaloUserId } });

const create = (data, villageIds = []) =>
  prisma.adminUser.create({
    data: {
      ...data,
      villages: villageIds.length ? { connect: villageIds.map((id) => ({ id })) } : undefined,
    },
    include: { villages: true },
  });

const update = (id, data, villageIds) =>
  prisma.adminUser.update({
    where: { id },
    data: {
      ...data,
      ...(villageIds !== undefined && {
        villages: { set: villageIds.map((vid) => ({ id: vid })) },
      }),
    },
    include: { villages: true },
  });

const remove = (id) => prisma.adminUser.delete({ where: { id } });

module.exports = { findAll, findById, findByUsername, findByZaloUserId, create, update, remove };
