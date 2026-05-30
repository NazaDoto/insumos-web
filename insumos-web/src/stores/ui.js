import { defineStore } from 'pinia'

let idSeq = 1

export const useUiStore = defineStore('ui', {
  state: () => ({
    toasts: [],
    sidebarOpen: false,
  }),
  actions: {
    notify(message, type = 'info', timeout = 3800) {
      const id = idSeq++
      this.toasts.push({ id, message, type })
      setTimeout(() => this.dismiss(id), timeout)
    },
    success(m) { this.notify(m, 'success') },
    error(m) { this.notify(m, 'error', 5000) },
    warning(m) { this.notify(m, 'warning', 4500) },
    info(m) { this.notify(m, 'info') },
    dismiss(id) { this.toasts = this.toasts.filter((t) => t.id !== id) },
    toggleSidebar() { this.sidebarOpen = !this.sidebarOpen },
    closeSidebar() { this.sidebarOpen = false },
  },
})
