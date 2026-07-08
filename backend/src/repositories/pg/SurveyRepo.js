const { prisma } = require("../../config/database");

const findAll = () =>
  prisma.survey.findMany({
    include: {
      _count: { select: { questions: true, responses: true } },
    },
    orderBy: { createdAt: "desc" },
  });

const findById = (id) =>
  prisma.survey.findUnique({
    where: { id },
    include: {
      questions: { orderBy: { thuTu: "asc" } },
      _count: { select: { responses: true } },
    },
  });

const create = async ({ tieuDe, notificationId, deadline, questions }) => {
  return prisma.survey.create({
    data: {
      tieuDe,
      notificationId: notificationId || null,
      deadline: deadline ? new Date(deadline) : null,
      questions: {
        create: questions.map((q, i) => ({
          thuTu: i,
          cauHoi: q.cauHoi,
          loai: q.loai || "SINGLE",
          luaChon: q.luaChon || [],
        })),
      },
    },
    include: { questions: true },
  });
};

const update = async (id, { tieuDe, deadline, questions }) => {
  return prisma.$transaction(async (tx) => {
    await tx.surveyQuestion.deleteMany({ where: { surveyId: id } });
    return tx.survey.update({
      where: { id },
      data: {
        tieuDe,
        deadline: deadline ? new Date(deadline) : null,
        questions: {
          create: questions.map((q, i) => ({
            thuTu: i,
            cauHoi: q.cauHoi,
            loai: q.loai || "SINGLE",
            luaChon: q.luaChon || [],
          })),
        },
      },
      include: { questions: { orderBy: { thuTu: "asc" } } },
    });
  });
};

const remove = (id) =>
  prisma.survey.delete({ where: { id } });

const close = (id) =>
  prisma.survey.update({ where: { id }, data: { isActive: false } });

const addResponse = (data) =>
  prisma.surveyResponse.create({ data });

const getResponses = (surveyId) =>
  prisma.surveyResponse.findMany({ where: { surveyId } });

const getResults = async (surveyId) => {
  const survey = await findById(surveyId);
  if (!survey) return null;

  const responses = await getResponses(surveyId);

  const summary = survey.questions.map((q) => {
    const counts = {};
    for (const resp of responses) {
      const ans = resp.answers[q.id];
      if (!ans) continue;
      const vals = Array.isArray(ans) ? ans : [ans];
      for (const v of vals) {
        counts[v] = (counts[v] || 0) + 1;
      }
    }
    return { questionId: q.id, cauHoi: q.cauHoi, loai: q.loai, counts, total: responses.length };
  });

  return { survey, totalResponses: responses.length, summary };
};

module.exports = { findAll, findById, create, update, remove, close, addResponse, getResponses, getResults };
