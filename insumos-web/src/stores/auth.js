import { defineStore } from 'pinia'
import api from '@/services/api'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: JSON.parse(localStorage.getItem('user') || 'null'),
    token: localStorage.getItem('token') || null,
  }),
  getters: {
    isAuthenticated: (s) => !!s.token,
    role: (s) => s.user?.role || null,
    fullName: (s) => (s.user ? `${s.user.firstName} ${s.user.lastName}` : ''),
    initials: (s) =>
      s.user ? `${s.user.firstName?.[0] || ''}${s.user.lastName?.[0] || ''}`.toUpperCase() : '',
  },
  actions: {
    async login(identifier, password) {
      const { data } = await api.post('/auth/login', { identifier, password })
      this.token = data.token
      this.user = data.user
      localStorage.setItem('token', data.token)
      localStorage.setItem('user', JSON.stringify(data.user))
      return data.user
    },
    async fetchMe() {
      const { data } = await api.get('/auth/me')
      this.user = data.user
      localStorage.setItem('user', JSON.stringify(data.user))
      return data.user
    },
    async logout() {
      try { await api.post('/auth/logout') } catch (e) { /* ignore */ }
      this.token = null
      this.user = null
      localStorage.removeItem('token')
      localStorage.removeItem('user')
    },
  },
})
