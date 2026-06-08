import api from './api'

export const getAll = (params = {}) => api.get('/movements', { params })

export const create = (data) => api.post('/movements', data)
