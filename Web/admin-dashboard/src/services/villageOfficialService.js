import api from './api'

export const getAll = (params) => api.get('/village-officials', { params })

export const getById = (id) => api.get(`/village-officials/${id}`)

export const create = (data) => api.post('/village-officials', data)

export const update = (id, data) => api.put(`/village-officials/${id}`, data)

export const remove = (id) => api.delete(`/village-officials/${id}`)
