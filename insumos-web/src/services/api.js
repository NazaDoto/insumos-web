import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 20000,
})

// Adjunta el token JWT en cada request.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Manejo centralizado de errores y sesion expirada.
api.interceptors.response.use(
  (res) => res,
  (error) => {
    const status = error.response?.status
    if (status === 401 && !error.config?.url?.includes('/auth/login')) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      if (window.location.pathname !== '/login') {
        window.location.href = '/login?expired=1'
      }
    }
    const message =
      error.response?.data?.message || error.message || 'Error de conexion con el servidor'
    error.userMessage = message
    error.details = error.response?.data?.details
    return Promise.reject(error)
  }
)

export default api
