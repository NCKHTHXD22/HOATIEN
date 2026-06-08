const { prisma } = require("../../config/database");

const create = (data) =>
  prisma.notification.create({ data });

const findById = (id) =>
  prisma.notification.findUnique({
    where: { id },
    include: {
      admin: { select: { id: true, hoTen: true } },
      attachments: true,
      recipients: {
        include: {
          member: { select: { id: true, hoTen: true, sdt: true, email: true, zaloUserId: true } },
          group: { select: { id: true, ten: true } },
        },
      },
      surveys: { include: { questions: true } },
    },
  });

const findMany = async ({ page = 1, limit = 20, trangThai, search } = {}) => {
  const where = {};
  if (trangThai) where.trangThai = trangThai;
  if (search) where.tieuDe = { contains: search, mode: "insensitive" };
  const skip = (page - 1) * limit;
  const [rows, total] = await Promise.all([
    prisma.notification.findMany({
      where,
      skip,
      take: parseInt(limit),
      orderBy: { createdAt: "desc" },
      include: {
        admin: { select: { hoTen: true } },
        _count: { select: { sends: true } },
      },
    }),
    prisma.notification.count({ where }),
  ]);
  return [rows, total];
};

const update = (id, data) =>
  prisma.notification.update({ where: { id }, data });

const remove = (id) =>
  prisma.notification.delete({ where: { id } });

const findScheduledReady = () =>
  prisma.notification.findMany({
    where: { trangThai: "CHO_GUI", scheduledAt: { lte: new Date() } },
    include: {
      recipients: {
        include: {
          member: true,
          group: { include: { members: { include: { member: true } } } },
        },
      },
    },
  });

// ── Recipients ─────────────────────────────────────────────

const addRecipients = (data) =>
  prisma.notificationRecipient.createMany({ data, skipDuplicates: true });

const clearRecipients = (notificationId) =>
  prisma.notificationRecipient.deleteMany({ where: { notificationId } });

// ── Sends ──────────────────────────────────────────────────

const createSends = (sends) =>
  prisma.notificationSend.createMany({ data: sends, skipDuplicates: true });

const findSends = (notificationId) =>
  prisma.notificationSend.findMany({
    where: { notificationId },
    include: {
      member: {
        select: {
          id: true,
          hoTen: true,
          sdt: true,
          email: true,
          zaloUserId: true,
          household: { select: { village: { select: { ten: true } } } },
        },
      },
      feedbacks: true,
    },
    orderBy: { createdAt: "asc" },
  });

const updateSend = (id, data) =>
  prisma.notificationSend.update({ where: { id }, data });

const createFeedback = (data) =>
  prisma.notificationFeedback.create({ data });

// ── Attachments ────────────────────────────────────────────

const addAttachment = (data) =>
  prisma.notificationAttachment.create({ data });

// ── Report ─────────────────────────────────────────────────

const getStats = async (days = 30) => {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const [totalNotifs, sendGroups, channelGroups] = await Promise.all([
    prisma.notification.count({
      where: { trangThai: "DA_GUI", sentAt: { gte: since } },
    }),
    prisma.notificationSend.groupBy({
      by: ["trangThai"],
      _count: { _all: true },
      where: { createdAt: { gte: since } },
    }),
    prisma.notificationSend.groupBy({
      by: ["kenh"],
      _count: { _all: true },
      where: { createdAt: { gte: since } },
    }),
  ]);
  return { totalNotifs, sendGroups, channelGroups };
};

module.exports = {
  create, findById, findMany, update, remove, findScheduledReady,
  addRecipients, clearRecipients,
  createSends, findSends, updateSend, createFeedback,
  addAttachment, getStats,
};
