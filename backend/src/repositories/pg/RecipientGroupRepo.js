const { prisma } = require("../../config/database");

const findAll = (adminId, role) => {
  const where = role === "SUPER_ADMIN" ? {} : { createdBy: adminId };
  return prisma.recipientGroup.findMany({
    where,
    include: {
      _count: { select: { members: true } },
      admin: { select: { hoTen: true } },
    },
    orderBy: { createdAt: "desc" },
  });
};

const findById = (id) =>
  prisma.recipientGroup.findUnique({
    where: { id },
    include: {
      members: {
        include: {
          member: {
            select: {
              id: true,
              hoTen: true,
              sdt: true,
              email: true,
              zaloUserId: true,
              gioiTinh: true,
              household: { select: { village: { select: { ten: true } } } },
            },
          },
        },
      },
    },
  });

const create = (data) =>
  prisma.recipientGroup.create({ data });

const update = (id, data) =>
  prisma.recipientGroup.update({ where: { id }, data });

const remove = (id) =>
  prisma.recipientGroup.delete({ where: { id } });

const addMembers = (groupId, memberIds) =>
  prisma.recipientGroupMember.createMany({
    data: memberIds.map((memberId) => ({ groupId, memberId })),
    skipDuplicates: true,
  });

const removeMembers = (groupId, memberIds) =>
  prisma.recipientGroupMember.deleteMany({
    where: { groupId, memberId: { in: memberIds } },
  });

const buildAutoGroup = async (groupId, tieuChi) => {
  const { villageId, gioiTinh, tuoiMin, tuoiMax, loaiHo } = tieuChi || {};
  const where = { trangThai: "ACTIVE" };

  if (gioiTinh) where.gioiTinh = gioiTinh;

  if (villageId || loaiHo) {
    where.household = {};
    if (villageId) where.household.villageId = villageId;
    if (loaiHo) where.household.loaiHo = loaiHo;
  }

  if (tuoiMin || tuoiMax) {
    const now = new Date();
    where.ngaySinh = {};
    if (tuoiMin) {
      where.ngaySinh.lte = new Date(
        now.getFullYear() - tuoiMin, now.getMonth(), now.getDate()
      );
    }
    if (tuoiMax) {
      where.ngaySinh.gte = new Date(
        now.getFullYear() - tuoiMax, now.getMonth(), now.getDate()
      );
    }
  }

  const members = await prisma.member.findMany({ where, select: { id: true } });
  await prisma.recipientGroupMember.deleteMany({ where: { groupId } });

  if (members.length > 0) {
    await prisma.recipientGroupMember.createMany({
      data: members.map((m) => ({ groupId, memberId: m.id })),
    });
  }

  return members.length;
};

module.exports = {
  findAll, findById, create, update, remove,
  addMembers, removeMembers, buildAutoGroup,
};
