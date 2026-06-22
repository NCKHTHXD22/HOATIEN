const { prisma } = require("../config/database");
const InAppAlert = require("../models/mongo/InAppAlert");
const logger = require("../utils/logger");

async function createAlert({ recipientId, type, title, body, refId }) {
  try {
    if (!recipientId) return null;
    const alert = await InAppAlert.create({
      recipientId: recipientId.toString(),
      type,
      title,
      body: body || "",
      refId: refId ? refId.toString() : null,
      read: false
    });
    return alert;
  } catch (err) {
    logger.error(`[InAppAlert] Lỗi khi tạo alert: ${err.message}`);
    return null;
  }
}

// 1. Phản ánh mới: gửi cho tất cả SUPER_ADMIN và DEPT_LEADER phụ trách lĩnh vực đó
async function notifyNewFeedback(feedback) {
  try {
    const code = feedback._id.toString().slice(-5).toUpperCase();
    const title = `Phản ánh mới cần xử lý: #${code}`;
    const body = `${feedback.displayName || "Người dân"} gửi phản ánh mới thuộc lĩnh vực ${feedback.linhVuc || "Chưa phân loại"}`;
    
    // Tìm các leaders/admins
    const admins = await prisma.adminUser.findMany({
      where: {
        role: { in: ["SUPER_ADMIN", "DEPT_LEADER"] },
        isActive: true
      },
      select: { id: true, role: true, categoryIds: true }
    });
    
    const categoryId = feedback.categoryId ? feedback.categoryId.toString() : null;
    const recipientIds = [];
    
    for (const admin of admins) {
      if (admin.role === "SUPER_ADMIN") {
        recipientIds.push(admin.id);
      } else if (admin.role === "DEPT_LEADER") {
        const cIds = admin.categoryIds || [];
        // Nếu không cấu hình categoryIds, nhận hết. Hoặc nếu cấu hình và có chứa categoryId của feedback
        if (cIds.length === 0 || (categoryId && cIds.includes(categoryId))) {
          recipientIds.push(admin.id);
        }
      }
    }
    
    const uniqueRecipients = [...new Set(recipientIds)];
    await Promise.all(uniqueRecipients.map(recipientId => createAlert({
      recipientId,
      type: "feedback_new",
      title,
      body,
      refId: feedback._id
    })));
  } catch (err) {
    logger.error(`[InAppAlert] Lỗi notifyNewFeedback: ${err.message}`);
  }
}

// 2. Phân công: gửi cho cán bộ được giao
async function notifyAssigned(feedback, assignerId) {
  try {
    if (!feedback.assignedTo) return;
    const code = feedback._id.toString().slice(-5).toUpperCase();
    const title = `Bạn được phân công xử lý phản ánh #${code}`;
    
    let assignerName = "Lãnh đạo";
    if (assignerId) {
      const assigner = await prisma.adminUser.findUnique({ where: { id: assignerId }, select: { hoTen: true } });
      if (assigner) assignerName = assigner.hoTen;
    }
    
    const body = `${assignerName} đã giao cho bạn xử lý phản ánh #${code}.`;
    
    await createAlert({
      recipientId: feedback.assignedTo,
      type: "feedback_assigned",
      title,
      body,
      refId: feedback._id
    });
  } catch (err) {
    logger.error(`[InAppAlert] Lỗi notifyAssigned: ${err.message}`);
  }
}

// 3. Dự thảo: gửi cho lãnh đạo đã giao việc (hoặc tất cả leaders/admins phụ trách lĩnh vực nếu tự soạn hoặc assigner không tìm thấy)
async function notifyDraft(feedback, draftCreatorId) {
  try {
    const code = feedback._id.toString().slice(-5).toUpperCase();
    const title = `Có dự thảo phản hồi mới cho phản ánh #${code}`;
    
    let draftCreatorName = "Cán bộ";
    if (draftCreatorId) {
      const creator = await prisma.adminUser.findUnique({ where: { id: draftCreatorId }, select: { hoTen: true } });
      if (creator) draftCreatorName = creator.hoTen;
    }
    const body = `${draftCreatorName} đã soạn dự thảo cho phản ánh #${code}.`;
    
    const recipientIds = [];
    if (feedback.assignedBy) {
      recipientIds.push(feedback.assignedBy);
    }
    
    // Luôn gửi cho leaders cùng lĩnh vực nữa đề phòng assigner nghỉ hoặc bận
    const admins = await prisma.adminUser.findMany({
      where: {
        role: { in: ["SUPER_ADMIN", "DEPT_LEADER"] },
        isActive: true
      },
      select: { id: true, role: true, categoryIds: true }
    });
    
    const categoryId = feedback.categoryId ? feedback.categoryId.toString() : null;
    for (const admin of admins) {
      if (admin.role === "SUPER_ADMIN") {
        recipientIds.push(admin.id);
      } else if (admin.role === "DEPT_LEADER") {
        const cIds = admin.categoryIds || [];
        if (cIds.length === 0 || (categoryId && cIds.includes(categoryId))) {
          recipientIds.push(admin.id);
        }
      }
    }
    
    const uniqueRecipients = [...new Set(recipientIds)];
    await Promise.all(uniqueRecipients.map(recipientId => createAlert({
      recipientId,
      type: "feedback_draft",
      title,
      body,
      refId: feedback._id
    })));
  } catch (err) {
    logger.error(`[InAppAlert] Lỗi notifyDraft: ${err.message}`);
  }
}

// 4. Duyệt dự thảo: gửi cán bộ soạn dự thảo
async function notifyApproved(feedback, approverId) {
  try {
    if (!feedback.draftBy) return;
    const code = feedback._id.toString().slice(-5).toUpperCase();
    const title = `Dự thảo phản ánh #${code} đã được duyệt`;
    
    let approverName = "Lãnh đạo";
    if (approverId) {
      const approver = await prisma.adminUser.findUnique({ where: { id: approverId }, select: { hoTen: true } });
      if (approver) approverName = approver.hoTen;
    }
    const body = `${approverName} đã duyệt và gửi phản hồi của phản ánh #${code} cho người dân.`;
    
    await createAlert({
      recipientId: feedback.draftBy,
      type: "feedback_approved",
      title,
      body,
      refId: feedback._id
    });
  } catch (err) {
    logger.error(`[InAppAlert] Lỗi notifyApproved: ${err.message}`);
  }
}

// 5. Từ chối dự thảo: gửi cán bộ soạn dự thảo
async function notifyRejected(feedback, rejectorId, reason) {
  try {
    if (!feedback.draftBy) return;
    const code = feedback._id.toString().slice(-5).toUpperCase();
    const title = `Dự thảo phản ánh #${code} bị từ chối`;
    
    let rejectorName = "Lãnh đạo";
    if (rejectorId) {
      const rejector = await prisma.adminUser.findUnique({ where: { id: rejectorId }, select: { hoTen: true } });
      if (rejector) rejectorName = rejector.hoTen;
    }
    const body = `${rejectorName} đã từ chối dự thảo của phản ánh #${code}. Lý do: ${reason || "Không có lý do chi tiết"}`;
    
    await createAlert({
      recipientId: feedback.draftBy,
      type: "feedback_rejected",
      title,
      body,
      refId: feedback._id
    });
  } catch (err) {
    logger.error(`[InAppAlert] Lỗi notifyRejected: ${err.message}`);
  }
}

module.exports = {
  createAlert,
  notifyNewFeedback,
  notifyAssigned,
  notifyDraft,
  notifyApproved,
  notifyRejected
};
