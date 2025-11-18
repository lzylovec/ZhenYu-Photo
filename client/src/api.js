import axios from 'axios'

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || 'http://localhost:4002/api',
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  const csrf = localStorage.getItem('csrf')
  const method = (config.method || 'get').toLowerCase()
  if (csrf && (method === 'post' || method === 'put' || method === 'delete')) {
    config.headers['X-CSRF-Token'] = csrf
  }
  return config
})