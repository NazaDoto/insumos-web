<script>
import { mapState } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import api from '@/services/api'
import DataTable from '@/components/ui/DataTable.vue'
import Pagination from '@/components/ui/Pagination.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'

export default {
  name: 'OrdersView',
  components: { DataTable, Pagination, StatusBadge },
  data() {
    return {
      rows: [], meta: {}, loading: true, page: 1, status: '',
      statuses: [
        { v: 'pending', l: 'Pendiente' }, { v: 'accepted', l: 'Aceptado' }, { v: 'rejected', l: 'Rechazado' },
        { v: 'preparing', l: 'En preparacion' }, { v: 'sent', l: 'Enviado' }, { v: 'delivered', l: 'Entregado' },
        { v: 'cancelled', l: 'Cancelado' }, { v: 'partial', l: 'Entrega parcial' },
      ],
      columns: [
        { key: 'id', label: '#' },
        { key: 'counterpart', label: 'Contraparte' },
        { key: 'items_count', label: 'Items', align: 'right' },
        { key: 'status', label: 'Estado' },
        { key: 'created_at', label: 'Fecha' },
        { key: 'actions', label: '', align: 'right' },
      ],
    }
  },
  computed: {
    ...mapState(useAuthStore, ['role']),
    isAdmin() { return this.role === 'admin' },
    isProvider() { return this.role === 'provider' },
  },
  mounted() { this.load() },
  methods: {
    async load() {
      this.loading = true
      try { const { data } = await api.get('/orders', { params: { status: this.status, page: this.page, limit: 20 } }); this.rows = data.data; this.meta = data.meta }
      catch (e) { useUiStore().error(e.userMessage) } finally { this.loading = false }
    },
    onFilter() { this.page = 1; this.load() },
    changePage(p) { this.page = p; this.load() },
    date(d) { return d ? new Date(d).toLocaleDateString('es-AR') : '' },
  },
}
</script>

<template>
  <div>
    <div class="page-header">
      <div><h1>Pedidos</h1><p>{{ isProvider ? 'Pedidos recibidos de administradores' : 'Pedidos realizados a proveedores' }}</p></div>
      <RouterLink v-if="isAdmin" to="/orders/new" class="btn btn-primary">+ Nuevo pedido</RouterLink>
    </div>

    <div class="toolbar">
      <select v-model="status" class="select" style="max-width:200px" @change="onFilter">
        <option value="">Todos los estados</option>
        <option v-for="s in statuses" :key="s.v" :value="s.v">{{ s.l }}</option>
      </select>
    </div>

    <DataTable :columns="columns" :rows="rows" :loading="loading">
      <template #cell-id="{ row }">#{{ row.id }}</template>
      <template #cell-counterpart="{ row }">{{ isProvider ? row.admin_name : row.provider_name }}</template>
      <template #cell-status="{ row }"><StatusBadge :status="row.status" /></template>
      <template #cell-created_at="{ row }"><span class="muted">{{ date(row.created_at) }}</span></template>
      <template #cell-actions="{ row }">
        <RouterLink :to="`/orders/${row.id}`" class="btn btn-sm">Ver detalle</RouterLink>
      </template>
      <template #footer><Pagination :meta="meta" @change="changePage" /></template>
    </DataTable>
  </div>
</template>
