import api from './api'

export const getAll = () => api.get('/villages')

export const getById = (id) => api.get(`/villages/${id}`)

export const create = (data) => api.post('/villages', data)

export const update = (id, data) => api.put(`/villages/${id}`, data)

export const remove = (id) => api.delete(`/villages/${id}`)
