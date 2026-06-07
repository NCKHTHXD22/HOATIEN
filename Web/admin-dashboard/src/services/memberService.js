import api from './api'

export const getByHousehold = (householdId) =>
  api.get(`/members/household/${householdId}`)

export const getById = (id) => api.get(`/members/${id}`)

export const create = (data) => api.post('/members', data)

export const update = (id, data) => api.put(`/members/${id}`, data)

export const remove = (id) => api.delete(`/members/${id}`)
