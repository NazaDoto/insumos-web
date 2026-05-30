<script>
import { mapState, mapActions } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'

const NAV = [
  { to: '/dashboard', label: 'Dashboard', ico: '\u25A0', roles: ['sysadmin', 'admin', 'provider', 'employee'] },
  { section: 'Gestion' },
  { to: '/users', label: 'Usuarios', ico: '\u{1F465}', roles: ['sysadmin', 'admin'] },
  { to: '/items', label: 'Insumos', ico: '\u{1F4E6}', roles: ['sysadmin', 'admin'] },
  { to: '/catalog', label: 'Mi stock', ico: '\u{1F4E6}', roles: ['provider'] },
  { to: '/categories', label: 'Categorias', ico: '\u{1F3F7}', roles: ['sysadmin', 'admin'] },
  { to: '/branches', label: 'Oficinas / Sucursales', ico: '\u{1F3E2}', roles: ['sysadmin', 'admin', 'employee'] },
  { section: 'Operaciones' },
  { to: '/stock', label: 'Stock disponible', ico: '\u{1F4CA}', roles: ['sysadmin', 'admin', 'employee'] },
  { to: '/movements', label: 'Movimientos', ico: '\u{1F501}', roles: ['sysadmin', 'admin'] },
  { to: '/providers', label: 'Proveedores', ico: '\u{1F69A}', roles: ['sysadmin', 'admin'] },
  { to: '/orders', label: 'Pedidos', ico: '\u{1F4CB}', roles: ['sysadmin', 'admin', 'provider'] },
  { to: '/usage', label: 'Uso de insumos', ico: '\u270D', roles: ['sysadmin', 'admin', 'employee'] },
  { section: 'Analisis' },
  { to: '/reports', label: 'Reportes', ico: '\u{1F4C8}', roles: ['sysadmin', 'admin', 'provider'] },
  { to: '/logs', label: 'Logs y auditoria', ico: '\u{1F50D}', roles: ['sysadmin', 'admin'] },
  { to: '/custom-fields', label: 'Atributos personalizados', ico: '\u2699', roles: ['sysadmin', 'admin'] },
]

const ROLE_LABEL = {
  sysadmin: 'Administrador del Sistema',
  admin: 'Administrador',
  provider: 'Proveedor',
  employee: 'Empleado',
}

export default {
  name: 'AppLayout',
  computed: {
    ...mapState(useAuthStore, ['user', 'role', 'fullName', 'initials']),
    ...mapState(useUiStore, ['sidebarOpen']),
    roleLabel() { return ROLE_LABEL[this.role] || '' },
    navItems() {
      const out = []
      let pending = null
      for (const item of NAV) {
        if (item.section) { pending = item; continue }
        if (item.roles.includes(this.role)) {
          if (pending) { out.push(pending); pending = null }
          out.push(item)
        }
      }
      return out
    },
    pageTitle() { return this.$route.meta.title || '' },
  },
  methods: {
    ...mapActions(useUiStore, ['toggleSidebar', 'closeSidebar']),
    ...mapActions(useAuthStore, ['logout']),
    async doLogout() {
      await this.logout()
      this.$router.push('/login')
    },
  },
}
</script>

<template>
  <div class="app-shell">
    <aside :class="['sidebar', { open: sidebarOpen }]">
      <div class="brand">
        <span class="logo">{{ '\u{1F4E6}' }}</span>
        <span>Insumos</span>
      </div>
      <nav @click="closeSidebar">
        <template v-for="(item, i) in navItems" :key="i">
          <div v-if="item.section" class="nav-section">{{ item.section }}</div>
          <RouterLink v-else :to="item.to" class="nav-link">
            <span class="ico">{{ item.ico }}</span>
            <span>{{ item.label }}</span>
          </RouterLink>
        </template>
      </nav>
    </aside>

    <div class="main">
      <header class="topbar">
        <div class="flex items-center gap-3">
          <button class="btn btn-ghost menu-toggle" @click="toggleSidebar">&#9776;</button>
          <span class="page-title">{{ pageTitle }}</span>
        </div>
        <div class="user-chip">
          <RouterLink to="/profile" class="flex items-center gap-2">
            <div style="text-align:right">
              <div style="font-weight:600;font-size:13px">{{ fullName }}</div>
              <div class="muted" style="font-size:11.5px">{{ roleLabel }}</div>
            </div>
            <div class="avatar">{{ initials }}</div>
          </RouterLink>
          <button class="btn btn-sm" @click="doLogout">Salir</button>
        </div>
      </header>
      <main class="content">
        <RouterView />
      </main>
    </div>
  </div>
</template>
