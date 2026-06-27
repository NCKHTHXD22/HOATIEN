import axios from 'axios'

// Instance riêng cho module broadcast: baseURL KHÔNG kèm /api (các path tự thêm /api/broadcast...)
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
})

// Gắn JWT (cùng key 'token' với AuthContext của HOATIEN)
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && window.location.pathname !== '/login') {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)
