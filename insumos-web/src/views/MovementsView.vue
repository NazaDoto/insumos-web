<script>
import { useUiStore } from '@/stores/ui'
import api from '@/services/api'
import DataTable from '@/components/ui/DataTable.vue'
import Pagination from '@/components/ui/Pagination.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import ExportExcelButton from '@/components/ui/ExportExcelButton.vue'
import StockMovementModal from '@/components/stock/StockMovementModal.vue'

export default {
  name: 'MovementsView',
  components: { DataTable, Pagination, StatusBadge, ExportExcelButton, StockMovementModal },
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
      types: [
        { v: 'income', l: 'Ingreso' }, { v: 'outcome', l: 'Egreso' }, { v: 'transfer', l: 'Transferencia' },
        { v: 'usage', l: 'Uso' }, { v: 'adjustment', l: 'Ajuste' },
        { v: 'order_received', l: 'Pedido recibido' }, { v: 'order_sent', l: 'Pedido enviado' },
      ],
      branches: [], items: [],
      showModal: false,
      moveInitial: {},
    }
  },
  mounted() { this.load(); this.loadBranches(); this.loadItems() },
  methods: {
    async load() {
      this.loading = true
      try { const { data } = await api.get('/stock/movements', { params: { ...this.filters, page: this.page, limit: 25 } }); this.rows = data.data; this.meta = data.meta }
      catch (e) { useUiStore().error(e.userMessage) } finally { this.loading = false }
    },
    async loadBranches() { try { const { data } = await api.get('/branches'); this.branches = data.data } catch (e) { /* */ } },
    async loadItems() { try { const { data } = await api.get('/items', { params: { limit: 100, status: 'active' } }); this.items = data.data } catch (e) { /* */ } },
    onFilter() { this.page = 1; this.load() },
    changePage(p) { this.page = p; this.load() },
    date(d) { return d ? new Date(d).toLocaleString('es-AR') : '' },
    openMove() {
      this.moveInitial = { type: 'income' }
      this.showModal = true
    },
    onMoveDone() { this.page = 1; this.load() },
  },
}
</script>

<template>
  <div>
    <div class="page-header">
      <div><h1>Movimientos de stock</h1><p>Ingresos desde sin asignar, egresos a sin asignar y transferencias entre sucursales</p></div>
      <button class="btn btn-primary" @click="openMove">+ Nuevo movimiento</button>
    </div>

    <div class="toolbar">
      <select v-model="filters.type" class="select" style="max-width:180px" @change="onFilter">
        <option value="">Todos los tipos</option>
        <option v-for="t in types" :key="t.v" :value="t.v">{{ t.l }}</option>
      </select>
      <input v-model="filters.from" class="input" type="date" @change="onFilter" />
      <input v-model="filters.to" class="input" type="date" @change="onFilter" />
      <div class="spacer"></div>
      <ExportExcelButton path="/export/movements" :params="filters" filename="movimientos" />
    </div>

    <DataTable :columns="columns" :rows="rows" :loading="loading">
      <template #cell-created_at="{ row }"><span class="muted">{{ date(row.created_at) }}</span></template>
      <template #cell-movement_type="{ row }"><StatusBadge :status="row.movement_type" /></template>
      <template #cell-origin_branch="{ row }">{{ row.origin_branch || '-' }}</template>
      <template #cell-destination_branch="{ row }">{{ row.destination_branch || '-' }}</template>
      <template #cell-user_name="{ row }">{{ row.user_name || '-' }}</template>
      <template #footer><Pagination :meta="meta" @change="changePage" /></template>
    </DataTable>

    <StockMovementModal
      :show="showModal"
      :initial="moveInitial"
      :branches="branches"
      :items="items"
      @close="showModal = false"
      @done="onMoveDone"
    />
  </div>
</template>
