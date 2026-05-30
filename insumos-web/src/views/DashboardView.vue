<script>
import { mapState } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import api from '@/services/api'
import StatusBadge from '@/components/ui/StatusBadge.vue'

const CARD_LABELS = {
  users: 'Usuarios', admins: 'Administradores', providers: 'Proveedores', employees: 'Empleados',
  items: 'Insumos', activeOrders: 'Pedidos activos',
  totalStock: 'Stock total', lowStock: 'Bajo stock', pendingOrders: 'Pedidos pendientes',
  branches: 'Sucursales', usages: 'Usos registrados',
  available: 'Stock disponible', pending: 'Pendientes', accepted: 'Aceptados', sent: 'Enviados',
}

export default {
  name: 'DashboardView',
  components: { StatusBadge },
  data() {
    return { loading: true, data: {}, role: null }
  },
  computed: {
    ...mapState(useAuthStore, ['fullName']),
    cards() {
      const c = this.data.cards || {}
      return Object.keys(c).map((k) => ({ key: k, label: CARD_LABELS[k] || k, value: c[k] }))
    },
  },
  async mounted() {
    try {
      const { data } = await api.get('/dashboard')
      this.data = data.data
      this.role = data.role
    } catch (e) {
      useUiStore().error(e.userMessage)
    } finally {
      this.loading = false
    }
  },
  methods: {
    fmt(n) { return Number(n || 0).toLocaleString('es-AR') },
    date(d) { return d ? new Date(d).toLocaleString('es-AR') : '' },
  },
}
</script>

<template>
  <div>
    <div class="page-header">
      <div>
        <h1>Hola, {{ fullName }}</h1>
        <p>Resumen general de tu actividad</p>
      </div>
    </div>

    <div v-if="loading" class="loading-center"><span class="spinner dark"></span></div>

    <template v-else>
      <div class="stat-grid mb-4">
        <div class="stat" v-for="c in cards" :key="c.key">
          <span class="stat-label">{{ c.label }}</span>
          <span class="stat-value" :style="c.key === 'lowStock' && c.value > 0 ? 'color:var(--c-danger)' : ''">
            {{ fmt(c.value) }}
          </span>
        </div>
      </div>

      <div class="grid-2">
        <div v-if="data.recentOrders" class="card">
          <div class="card-header"><h3>Pedidos recientes</h3><RouterLink to="/orders" class="btn btn-sm">Ver todos</RouterLink></div>
          <div class="table-wrap">
            <table class="data data-cards">
              <thead><tr><th>#</th><th>Contraparte</th><th>Estado</th><th>Fecha</th></tr></thead>
              <tbody>
                <tr v-for="o in data.recentOrders" :key="o.id">
                  <td data-label="#">#{{ o.id }}</td>
                  <td data-label="Contraparte">{{ o.provider_name || o.admin_name }}</td>
                  <td data-label="Estado"><StatusBadge :status="o.status" /></td>
                  <td class="muted" data-label="Fecha">{{ date(o.created_at) }}</td>
                </tr>
                <tr v-if="!data.recentOrders.length" class="empty-row"><td colspan="4" class="table-empty empty-cell">Sin pedidos</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        <div v-if="data.recentMovements" class="card">
          <div class="card-header"><h3>Movimientos recientes</h3></div>
          <div class="table-wrap">
            <table class="data data-cards">
              <thead><tr><th>Insumo</th><th>Tipo</th><th>Cant.</th><th>Fecha</th></tr></thead>
              <tbody>
                <tr v-for="m in data.recentMovements" :key="m.id">
                  <td data-label="Insumo">{{ m.item_name }}</td>
                  <td data-label="Tipo"><StatusBadge :status="m.movement_type" /></td>
                  <td data-label="Cant.">{{ fmt(m.quantity) }}</td>
                  <td class="muted" data-label="Fecha">{{ date(m.created_at) }}</td>
                </tr>
                <tr v-if="!data.recentMovements.length" class="empty-row"><td colspan="4" class="table-empty empty-cell">Sin movimientos</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        <div v-if="data.lowStockItems" class="card">
          <div class="card-header"><h3>Alertas de bajo stock</h3></div>
          <div class="table-wrap">
            <table class="data data-cards">
              <thead><tr><th>Insumo</th><th>Sucursal</th><th>Cant.</th><th>Min.</th></tr></thead>
              <tbody>
                <tr v-for="(it, i) in data.lowStockItems" :key="i">
                  <td data-label="Insumo">{{ it.name }}</td><td data-label="Sucursal">{{ it.branch }}</td>
                  <td style="color:var(--c-danger);font-weight:600" data-label="Cant.">{{ fmt(it.quantity) }}</td>
                  <td data-label="Min.">{{ fmt(it.minimum_stock) }}</td>
                </tr>
                <tr v-if="!data.lowStockItems.length" class="empty-row"><td colspan="4" class="table-empty empty-cell">Todo en orden</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        <div v-if="data.assignedBranches" class="card">
          <div class="card-header"><h3>Mis oficinas asignadas</h3></div>
          <div class="card-pad">
            <div v-for="b in data.assignedBranches" :key="b.id" class="row mb-4">
              <span class="badge blue">{{ b.name }}</span>
            </div>
            <p v-if="!data.assignedBranches.length" class="muted">No tiene oficinas asignadas</p>
            <RouterLink to="/usage/new" class="btn btn-primary mt-2">Registrar uso de insumo</RouterLink>
          </div>
        </div>

        <div v-if="data.recentUsages" class="card">
          <div class="card-header"><h3>Mis últimos usos</h3><RouterLink to="/usage" class="btn btn-sm">Ver historial</RouterLink></div>
          <div class="table-wrap">
            <table class="data data-cards">
              <thead><tr><th>Insumo</th><th>Sucursal</th><th>Cant.</th><th>Fecha</th></tr></thead>
              <tbody>
                <tr v-for="u in data.recentUsages" :key="u.id">
                  <td data-label="Insumo">{{ u.item_name }}</td><td data-label="Sucursal">{{ u.branch_name }}</td>
                  <td data-label="Cant.">{{ fmt(u.quantity) }}</td><td class="muted" data-label="Fecha">{{ date(u.created_at) }}</td>
                </tr>
                <tr v-if="!data.recentUsages.length" class="empty-row"><td colspan="4" class="table-empty empty-cell">Sin registros</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        <div v-if="data.recentLogs" class="card">
          <div class="card-header"><h3>Última actividad</h3><RouterLink to="/logs" class="btn btn-sm">Ver logs</RouterLink></div>
          <div class="table-wrap">
            <table class="data data-cards">
              <thead><tr><th>Usuario</th><th>Acción</th><th>Módulo</th><th>Fecha</th></tr></thead>
              <tbody>
                <tr v-for="l in data.recentLogs" :key="l.id">
                  <td data-label="Usuario">{{ l.user_name || '-' }}</td><td data-label="Acción">{{ l.action }}</td>
                  <td data-label="Módulo">{{ l.module }}</td><td class="muted" data-label="Fecha">{{ date(l.created_at) }}</td>
                </tr>
                <tr v-if="!data.recentLogs.length" class="empty-row"><td colspan="4" class="table-empty empty-cell">Sin actividad</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
