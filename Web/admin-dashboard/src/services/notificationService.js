import api from './api'

// ── Notifications ──────────────────────────────────────────

export const getNotifications = (params = {}) =>
  api.get('/notify/notifications', { params }).then(r => r.data)

export const createNotification = (data) =>
  api.post('/notify/notifications', data).then(r => r.data)

export const updateNotification = (id, data) =>
  api.put(`/notify/notifications/${id}`, data).then(r => r.data)

export const deleteNotification = (id) =>
  api.delete(`/notify/notifications/${id}`).then(r => r.data)

export const sendNotification = (id) =>
  api.post(`/notify/notifications/${id}/send`).then(r => r.data)

export const scheduleNotification = (id, scheduledAt) =>
  api.post(`/notify/notifications/${id}/schedule`, { scheduledAt }).then(r => r.data)

export const cancelSchedule = (id) =>
  api.post(`/notify/notifications/${id}/cancel`).then(r => r.data)

export const getNotificationSends = (id) =>
  api.get(`/notify/notifications/${id}/sends`).then(r => r.data)

export const confirmSend = (sendId) =>
  api.post(`/notify/sends/${sendId}/confirm`).then(r => r.data)

export const addFeedback = (sendId, noiDung) =>
  api.post(`/notify/sends/${sendId}/feedback`, { noiDung }).then(r => r.data)

export const uploadAttachment = (notificationId, file) => {
  const form = new FormData()
  form.append('file', file)
  return api.post(`/notify/notifications/${notificationId}/attachments`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(r => r.data)
}

export const getReportStats = (days = 30) =>
  api.get('/notify/reports', { params: { days } }).then(r => r.data)

// ── Recipients ─────────────────────────────────────────────

export const getMembers = (params = {}) =>
  api.get('/notify/members', { params }).then(r => r.data)

// ── Groups ─────────────────────────────────────────────────

export const getGroups = () =>
  api.get('/notify/groups').then(r => r.data)

export const createGroup = (data) =>
  api.post('/notify/groups', data).then(r => r.data)

export const updateGroup = (id, data) =>
  api.put(`/notify/groups/${id}`, data).then(r => r.data)

export const deleteGroup = (id) =>
  api.delete(`/notify/groups/${id}`).then(r => r.data)

export const getGroup = (id) =>
  api.get(`/notify/groups/${id}`).then(r => r.data)

export const addGroupMembers = (groupId, memberIds) =>
  api.post(`/notify/groups/${groupId}/members`, { memberIds }).then(r => r.data)

export const removeGroupMembers = (groupId, memberIds) =>
  api.delete(`/notify/groups/${groupId}/members`, { data: { memberIds } }).then(r => r.data)

export const rebuildAutoGroup = (groupId) =>
  api.post(`/notify/groups/${groupId}/rebuild`).then(r => r.data)

// ── Surveys ────────────────────────────────────────────────

export const getSurveys = () =>
  api.get('/notify/surveys').then(r => r.data)

export const createSurvey = (data) =>
  api.post('/notify/surveys', data).then(r => r.data)

export const getSurvey = (id) =>
  api.get(`/notify/surveys/${id}`).then(r => r.data)

export const updateSurvey = (id, data) =>
  api.put(`/notify/surveys/${id}`, data).then(r => r.data)

export const getSurveyResults = (id) =>
  api.get(`/notify/surveys/${id}/results`).then(r => r.data)

export const deleteSurvey = (id) =>
  api.delete(`/notify/surveys/${id}`).then(r => r.data)

export const closeSurvey = (id) =>
  api.put(`/notify/surveys/${id}/close`).then(r => r.data)
