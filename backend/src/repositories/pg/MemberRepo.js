const { prisma } = require("../../config/database");

const findById = (id) =>
  prisma.member.findUnique({ where: { id }, include: { household: { include: { village: true } } } });

const findByCCCD = (cccd) =>
  prisma.member.findUnique({ where: { cccd }, include: { household: { include: { village: true } } } });

const findBySdt = (sdt) =>
  prisma.member.findMany({ where: { sdt }, include: { household: { include: { village: true } } } });

const findByHouseholdId = (householdId) =>
  prisma.member.findMany({ where: { householdId }, orderBy: [{ laChuHo: "desc" }, { hoTen: "asc" }] });

const create = (data) => prisma.member.create({ data });

const createMany = (members) => prisma.member.createMany({ data: members });

const update = (id, data) => prisma.member.update({ where: { id }, data });

const updateMany = (ids, data) =>
  prisma.member.updateMany({ where: { id: { in: ids } }, data });

const remove = (id) => prisma.member.delete({ where: { id } });

module.exports = { findById, findByCCCD, findBySdt, findByHouseholdId, create, createMany, update, updateMany, remove };
