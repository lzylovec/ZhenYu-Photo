import axios from 'axios'

const fallbackBase = (() => {
  const envBase = import.meta.env.VITE_API_BASE
  if (envBase && typeof envBase === 'string' && envBase.trim()) return envBase
  try {
    const origin = window?.location?.origin
    if (origin) return origin + '/api'
  } catch {}
  return 'http://localhost:4002/api'
})()

export const api = axios.create({
  baseURL: fallbackBase,
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