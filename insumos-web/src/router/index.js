import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const routes = [
  { path: '/login', name: 'login', component: () => import('@/views/LoginView.vue'), meta: { public: true } },
  {
    path: '/',
    component: () => import('@/layouts/AppLayout.vue'),
    children: [
      { path: '', redirect: '/dashboard' },
      { path: 'dashboard', name: 'dashboard', component: () => import('@/views/DashboardView.vue'), meta: { title: 'Dashboard' } },

      { path: 'users', name: 'users', component: () => import('@/views/UsersView.vue'), meta: { title: 'Usuarios', roles: ['sysadmin', 'admin'] } },

      { path: 'items', name: 'items', component: () => import('@/views/ItemsView.vue'), meta: { title: 'Insumos', roles: ['sysadmin', 'admin'] } },
      { path: 'items/new', name: 'item-new', component: () => import('@/views/ItemFormView.vue'), meta: { title: 'Nuevo insumo', roles: ['sysadmin', 'admin'] } },
      { path: 'items/:id/edit', name: 'item-edit', component: () => import('@/views/ItemFormView.vue'), meta: { title: 'Editar insumo', roles: ['sysadmin', 'admin'] } },
      { path: 'items/:id', name: 'item-detail', component: () => import('@/views/ItemDetailView.vue'), meta: { title: 'Detalle de insumo', roles: ['sysadmin', 'admin'] } },

      { path: 'catalog', name: 'catalog', component: () => import('@/views/ProviderCatalogView.vue'), meta: { title: 'Mi stock', roles: ['provider'] } },

      { path: 'categories', name: 'categories', component: () => import('@/views/CategoriesView.vue'), meta: { title: 'Categorías', roles: ['sysadmin', 'admin', 'provider'] } },
      { path: 'branches', name: 'branches', component: () => import('@/views/BranchesView.vue'), meta: { title: 'Oficinas / Sucursales', roles: ['sysadmin', 'admin', 'employee'] } },

      { path: 'stock', name: 'stock', component: () => import('@/views/StockView.vue'), meta: { title: 'Stock', roles: ['sysadmin', 'admin', 'employee'] } },
      { path: 'movements', name: 'movements', component: () => import('@/views/MovementsView.vue'), meta: { title: 'Movimientos', roles: ['sysadmin', 'admin'] } },

      { path: 'providers', name: 'providers', component: () => import('@/views/ProvidersView.vue'), meta: { title: 'Proveedores', roles: ['sysadmin', 'admin'] } },

      { path: 'orders', name: 'orders', component: () => import('@/views/OrdersView.vue'), meta: { title: 'Pedidos', roles: ['sysadmin', 'admin', 'provider'] } },
      { path: 'orders/new', name: 'order-new', component: () => import('@/views/OrderCreateView.vue'), meta: { title: 'Nuevo pedido', roles: ['admin'] } },
      { path: 'orders/:id', name: 'order-detail', component: () => import('@/views/OrderDetailView.vue'), meta: { title: 'Detalle de pedido', roles: ['sysadmin', 'admin', 'provider'] } },

      { path: 'usage', name: 'usage', component: () => import('@/views/UsageView.vue'), meta: { title: 'Uso de insumos', roles: ['sysadmin', 'admin', 'employee'] } },
      { path: 'usage/new', name: 'usage-new', component: () => import('@/views/UsageFormView.vue'), meta: { title: 'Registrar uso', roles: ['employee', 'admin'] } },

      { path: 'reports', name: 'reports', component: () => import('@/views/ReportsView.vue'), meta: { title: 'Reportes', roles: ['sysadmin', 'admin', 'provider'] } },
      { path: 'logs', name: 'logs', component: () => import('@/views/LogsView.vue'), meta: { title: 'Logs y auditoría', roles: ['sysadmin', 'admin'] } },
      { path: 'custom-fields', name: 'custom-fields', component: () => import('@/views/CustomFieldsView.vue'), meta: { title: 'Atributos personalizados', roles: ['sysadmin', 'admin'] } },
      { path: 'profile', name: 'profile', component: () => import('@/views/ProfileView.vue'), meta: { title: 'Mi perfil' } },
    ],
  },
  { path: '/:pathMatch(.*)*', redirect: '/dashboard' },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 }),
})

router.beforeEach((to) => {
  const auth = useAuthStore()
  if (to.meta.public) {
    if (auth.isAuthenticated && to.name === 'login') return { name: 'dashboard' }
    return true
  }
  if (!auth.isAuthenticated) return { name: 'login', query: { redirect: to.fullPath } }
  if (to.meta.roles && !to.meta.roles.includes(auth.role)) {
    return { name: 'dashboard' }
  }
  return true
})

export default router
