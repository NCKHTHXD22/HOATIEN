import api from './api'

export const getAll = (params = {}) =>
  api.get('/households', { params })

export const search = (q) =>
  api.get('/households/search', { params: { q } })

export const getToList = (villageId) =>
  api.get('/households/to-list', { params: { villageId } })

export const getById = (id) => api.get(`/households/${id}`)

export const getHistory = (id) => api.get(`/households/${id}/history`)

export const create = (data) => api.post('/households', data)

export const update = (id, data) => api.put(`/households/${id}`, data)

export const remove = (id) => api.delete(`/households/${id}`)

export const split = (id, data) => api.post(`/households/${id}/split`, data)

export const merge = (data) => api.post('/households/merge', data)

// Import Excel — xem trước (upload file) rồi ghi (commit token)
export const previewImport = (file) => {
  const fd = new FormData()
  fd.append('file', file)
  return api.post('/households/import/preview', fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 60000,
  })
}

export const commitImport = (data) =>
  api.post('/households/import/commit', data, { timeout: 120000 })
