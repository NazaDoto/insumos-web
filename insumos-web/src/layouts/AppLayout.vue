<script>
import { mapState, mapActions } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import AppIcon from '@/components/icons/AppIcon.vue'

const NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: 'speedometer2', roles: ['sysadmin', 'admin', 'provider', 'employee'] },
  { section: 'Gestión' },
  { to: '/users', label: 'Usuarios', icon: 'people', roles: ['sysadmin', 'admin'] },
  { to: '/items', label: 'Insumos', icon: 'box-seam', roles: ['sysadmin', 'admin'] },
  { to: '/catalog', label: 'Mi stock', icon: 'box-seam', roles: ['provider'] },
  { to: '/categories', label: 'Categorías', icon: 'tags', roles: ['sysadmin', 'admin', 'provider'] },
  { to: '/branches', label: 'Oficinas / Sucursales', icon: 'building', roles: ['sysadmin', 'admin', 'employee'] },
  { section: 'Operaciones' },
  { to: '/stock', label: 'Stock disponible', icon: 'clipboard-data', roles: ['sysadmin', 'admin', 'employee'] },
  { to: '/movements', label: 'Movimientos', icon: 'arrow-left-right', roles: ['sysadmin', 'admin'] },
  { to: '/providers', label: 'Proveedores', icon: 'truck', roles: ['sysadmin', 'admin'] },
  { to: '/orders', label: 'Pedidos', icon: 'cart-check', roles: ['sysadmin', 'admin', 'provider'] },
  { to: '/usage', label: 'Uso de insumos', icon: 'pencil-square', roles: ['sysadmin', 'admin', 'employee'] },
  { section: 'Análisis' },
  { to: '/reports', label: 'Reportes', icon: 'graph-up-arrow', roles: ['sysadmin', 'admin', 'provider'] },
  { to: '/logs', label: 'Logs y auditoría', icon: 'journal-code', roles: ['sysadmin', 'admin'] },
  { to: '/custom-fields', label: 'Atributos personalizados', icon: 'sliders', roles: ['sysadmin', 'admin'] },
]

const ROLE_LABEL = {
  sysadmin: 'Administrador del Sistema',
  admin: 'Administrador',
  provider: 'Proveedor',
  employee: 'Empleado',
}

export default {
  name: 'AppLayout',
  components: { AppIcon },
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
        <span class="logo"><AppIcon name="box-seam-fill" :size="18" /></span>
        <span class="brand-text">Insumos</span>
      </div>
      <nav @click="closeSidebar">
        <template v-for="(item, i) in navItems" :key="i">
          <div v-if="item.section" class="nav-section">{{ item.section }}</div>
          <RouterLink v-else :to="item.to" class="nav-link">
            <span class="nav-ico"><AppIcon :name="item.icon" :size="17" /></span>
            <span>{{ item.label }}</span>
          </RouterLink>
        </template>
      </nav>
    </aside>
    <div v-if="sidebarOpen" class="sidebar-overlay" @click="closeSidebar"></div>

    <div class="main">
      <header class="topbar">
        <div class="flex items-center gap-3">
          <button type="button" class="btn btn-ghost menu-toggle" aria-label="Abrir menú" @click="toggleSidebar">
            <AppIcon name="list" :size="22" />
          </button>
          <span class="page-title">{{ pageTitle }}</span>
        </div>
        <div class="user-chip">
          <RouterLink to="/profile" class="flex items-center gap-2 user-profile-link">
            <div class="user-meta">
              <div class="user-name">{{ fullName }}</div>
              <div class="user-role">{{ roleLabel }}</div>
            </div>
            <div class="avatar">{{ initials }}</div>
          </RouterLink>
          <button type="button" class="btn btn-sm btn-logout" @click="doLogout">
            <AppIcon name="box-arrow-right" :size="15" />
            <span>Salir</span>
          </button>
        </div>
      </header>
      <main class="content">
        <RouterView />
      </main>
    </div>
  </div>
</template>
