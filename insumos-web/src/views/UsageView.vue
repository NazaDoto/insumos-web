<script>
import { mapState } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import api from '@/services/api'
import DataTable from '@/components/ui/DataTable.vue'
import Pagination from '@/components/ui/Pagination.vue'

export default {
  name: 'UsageView',
  components: { DataTable, Pagination },
  data() {
    return {
      rows: [], meta: {}, loading: true, page: 1,
      filters: { from: '', to: '', branchId: '' },
      branches: [],
      columns: [
        { key: 'created_at', label: 'Fecha' },
        { key: 'item_name', label: 'Insumo' },
        { key: 'quantity', label: 'Cant.', align: 'right' },
        { key: 'branch_name', label: 'Sucursal' },
        { key: 'used_for', label: 'Motivo' },
        { key: 'employee_name', label: 'Empleado' },
      ],
    }
  },
  computed: {
    ...mapState(useAuthStore, ['role']),
    isEmployee() { return this.role === 'employee' },
    cols() { return this.isEmployee ? this.columns.filter(c => c.key !== 'employee_name') : this.columns },
  },
  mounted() { this.load(); this.loadBranches() },
  methods: {
    async load() {
      this.loading = true
      try { const { data } = await api.get('/usage', { params: { ...this.filters, page: this.page, limit: 20 } }); this.rows = data.data; this.meta = data.meta }
      catch (e) { useUiStore().error(e.userMessage) } finally { this.loading = false }
    },
    async loadBranches() { try { const { data } = await api.get('/branches'); this.branches = data.data } catch (e) { /* */ } },
    onFilter() { this.page = 1; this.load() },
    changePage(p) { this.page = p; this.load() },
    date(d) { return d ? new Date(d).toLocaleString('es-AR') : '' },
  },
}
</script>

<template>
  <div>
    <div class="page-header">
      <div><h1>Uso de insumos</h1><p>{{ isEmployee ? 'Tu historial de usos registrados' : 'Usos registrados por empleados' }}</p></div>
      <RouterLink v-if="isEmployee || role === 'admin'" to="/usage/new" class="btn btn-primary">+ Registrar uso</RouterLink>
    </div>

    <div class="toolbar">
      <select v-model="filters.branchId" class="select" style="max-width:220px" @change="onFilter">
        <option value="">Todas las sucursales</option>
        <option v-for="b in branches" :key="b.id" :value="b.id">{{ b.name }}</option>
      </select>
      <input v-model="filters.from" class="input" type="date" @change="onFilter" />
      <input v-model="filters.to" class="input" type="date" @change="onFilter" />
    </div>

    <DataTable :columns="cols" :rows="rows" :loading="loading">
      <template #cell-created_at="{ row }"><span class="muted">{{ date(row.created_at) }}</span></template>
      <template #cell-quantity="{ row }">{{ row.quantity }} {{ row.unit }}</template>
      <template #cell-used_for="{ row }">{{ row.used_for || '-' }}</template>
      <template #footer><Pagination :meta="meta" @change="changePage" /></template>
    </DataTable>
  </div>
</template>
