import api from './api'

export const syncFollowers = () => api.post('/zalo/followers/sync')
export const getFollowers = () => api.get('/zalo/followers')
export const sendDirectMessage = (data) => api.post('/zalo/followers/send', data)
export const searchMembers = (q) => api.get(`/members/search?q=${encodeURIComponent(q)}`)
export const linkFollower = (userId, memberId) => api.post(`/zalo/followers/${userId}/link`, { memberId })
