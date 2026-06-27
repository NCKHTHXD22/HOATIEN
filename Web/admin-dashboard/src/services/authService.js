import api from './api'

export const login = (username, password) =>
  api.post('/auth/login', { username, password })

export const getMe = () => api.get('/auth/me')

export const getUsers = () => api.get('/auth/users')

export const createUser = (data) => api.post('/auth/users', data)

export const changePassword = (oldPassword, newPassword) =>
  api.put('/auth/change-password', { oldPassword, newPassword })

export const updateNotifyPermission = (userId, canSendNotification) =>
  api.put(`/auth/users/${userId}/notify-permission`, { canSendNotification })

export const updateUser = (userId, data) =>
  api.put(`/auth/users/${userId}`, data)
