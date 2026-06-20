import api from './api'

export const getAll = (params = {}) => api.get('/movements', { params })

export const create = (data) => api.post('/movements', data)

export const update = (id, data) => api.patch(`/movements/${id}`, data)

export const remove = (id) => api.delete(`/movements/${id}`)
