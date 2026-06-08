import api from './api'

export const getSummary = () => api.get('/reports/summary')

export const getByVillage = () => api.get('/reports/by-village')

export const getMovements = (params = {}) =>
  api.get('/reports/movements', { params })

export const exportExcel = () =>
  api.get('/reports/export/excel', { responseType: 'blob' })

export const exportPdf = () =>
  api.get('/reports/export/pdf', { responseType: 'blob' })
