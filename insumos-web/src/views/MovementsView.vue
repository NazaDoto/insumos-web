<script>
import { useUiStore } from '@/stores/ui'
import api from '@/services/api'
import DataTable from '@/components/ui/DataTable.vue'
import Pagination from '@/components/ui/Pagination.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'

export default {
  name: 'MovementsView',
  components: { DataTable, Pagination, StatusBadge },
  data() {
    return {
      rows: [], meta: {}, loading: true, page: 1,
      filters: { type: '', from: '', to: '' },
      columns: [
        { key: 'created_at', label: 'Fecha' },
        { key: 'item_name', label: 'Insumo' },
        { key: 'movement_type', label: 'Tipo' },
        { key: 'quantity', label: 'Cant.', align: 'right' },
        { key: 'origin_branch', label: 'Origen' },
        { key: 'destination_branch', label: 'Destino' },
        { key: 'user_name', label: 'Usuario' },
      ],
      types: ['income', 'outcome', 'transfer', 'usage', 'adjustment', 'order_received', 'order_sent'],
    }
  },
  mounted() { this.load() },
  methods: {
    async load() {
      this.loading = true
      try { const { data } = await api.get('/stock/movements', { params: { ...this.filters, page: this.page, limit: 25 } }); this.rows = data.data; this.meta = data.meta }
      catch (e) { useUiStore().error(e.userMessage) } finally { this.loading = false }
    },
    onFilter() { this.page = 1; this.load() },
    changePage(p) { this.page = p; this.load() },
    date(d) { return d ? new Date(d).toLocaleString('es-AR') : '' },
  },
}
</script>

<template>
  <div>
    <div class="page-header"><div><h1>Movimientos de stock</h1><p>Trazabilidad completa de ingresos, egresos y transferencias</p></div></div>

    <div class="toolbar">
      <select v-model="filters.type" class="select" style="max-width:180px" @change="onFilter">
        <option value="">Todos los tipos</option>
        <option v-for="t in types" :key="t" :value="t">{{ t }}</option>
      </select>
      <input v-model="filters.from" class="input" type="date" @change="onFilter" />
      <input v-model="filters.to" class="input" type="date" @change="onFilter" />
    </div>

    <DataTable :columns="columns" :rows="rows" :loading="loading">
      <template #cell-created_at="{ row }"><span class="muted">{{ date(row.created_at) }}</span></template>
      <template #cell-movement_type="{ row }"><StatusBadge :status="row.movement_type" /></template>
      <template #cell-origin_branch="{ row }">{{ row.origin_branch || '-' }}</template>
      <template #cell-destination_branch="{ row }">{{ row.destination_branch || '-' }}</template>
      <template #cell-user_name="{ row }">{{ row.user_name || '-' }}</template>
      <template #footer><Pagination :meta="meta" @change="changePage" /></template>
    </DataTable>
  </div>
</template>
