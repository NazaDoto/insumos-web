<script>
import { mapState } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import api from '@/services/api'
import DataTable from '@/components/ui/DataTable.vue'
import ExportExcelButton from '@/components/ui/ExportExcelButton.vue'
import StockMovementModal from '@/components/stock/StockMovementModal.vue'

export default {
  name: 'StockView',
  components: { DataTable, ExportExcelButton, StockMovementModal },
  data() {
    return {
      rows: [], loading: true,
      filters: { search: '', branchId: '', lowStock: '' },
      branches: [], items: [],
      columns: [
        { key: 'item_name', label: 'Insumo' },
        { key: 'branch_name', label: 'Sucursal' },
        { key: 'quantity', label: 'Cantidad', align: 'right' },
        { key: 'minimum_stock', label: 'Mínimo', align: 'right' },
        { key: 'state', label: 'Estado' },
      ],
      showModal: false,
      moveInitial: {},
    }
  },
  computed: {
    ...mapState(useAuthStore, ['role']),
    canMove() { return this.role === 'admin' || this.role === 'sysadmin' },
    actionColumns() {
      return this.canMove ? [...this.columns, { key: 'actions', label: '', align: 'right' }] : this.columns
    },
    listParams() {
      const p = { search: this.filters.search, lowStock: this.filters.lowStock }
      if (this.filters.branchId === 'unassigned') p.unassigned = 'true'
      else if (this.filters.branchId) p.branchId = this.filters.branchId
      return p
    },
  },
  mounted() {
    if (this.$route.query.branchId) this.filters.branchId = this.$route.query.branchId
    this.load(); this.loadBranches(); this.loadItems()
  },
  methods: {
    async load() {
      this.loading = true
      try { const { data } = await api.get('/stock', { params: this.listParams }); this.rows = data.data }
      catch (e) { useUiStore().error(e.userMessage) } finally { this.loading = false }
    },
    async loadBranches() { try { const { data } = await api.get('/branches'); this.branches = data.data } catch (e) { /* */ } },
    async loadItems() {
      if (!this.canMove) return
      try { const { data } = await api.get('/items', { params: { limit: 100, status: 'active' } }); this.items = data.data } catch (e) { /* */ }
    },
    isLow(r) { return Number(r.quantity) <= Number(r.minimum_stock) },
    openMove(type, row) {
      this.moveInitial = {
        type,
        itemId: row?.item_id || '',
        branchId: row?.branch_id || '',
        originBranchId: row?.branch_id || '',
        destinationBranchId: '',
        newQuantity: row?.branch_id != null ? Number(row.quantity) : null,
      }
      this.showModal = true
    },
  },
}
</script>

<template>
  <div>
    <div class="page-header">
      <div><h1>Stock disponible</h1><p>Stock sin asignar y por sucursal</p></div>
      <button v-if="canMove" class="btn btn-primary" @click="openMove('income')">+ Nuevo movimiento</button>
    </div>

    <div class="toolbar">
      <input v-model="filters.search" class="input search-input" placeholder="Buscar insumo..." @keyup.enter="load" />
      <select v-model="filters.branchId" class="select" style="max-width:220px" @change="load">
        <option value="">Todas las ubicaciones</option>
        <option v-if="canMove" value="unassigned">Sin asignar</option>
        <option v-for="b in branches" :key="b.id" :value="b.id">{{ b.name }}</option>
      </select>
      <label class="row" style="gap:6px"><input type="checkbox" v-model="filters.lowStock" true-value="true" false-value="" @change="load" /> Solo bajo stock</label>
      <button class="btn" @click="load">Filtrar</button>
      <div class="spacer"></div>
      <ExportExcelButton path="/export/stock" :params="listParams" filename="stock" />
    </div>

    <DataTable :columns="actionColumns" :rows="rows" :loading="loading">
      <template #cell-branch_name="{ row }">
        <span :class="{ muted: !row.branch_name }">{{ row.branch_name || 'Sin asignar' }}</span>
      </template>
      <template #cell-quantity="{ row }">
        <span :style="isLow(row) ? 'color:var(--c-danger);font-weight:600' : ''">{{ row.quantity }} {{ row.unit }}</span>
      </template>
      <template #cell-state="{ row }">
        <span v-if="isLow(row)" class="badge red">Bajo stock</span>
        <span v-else class="badge green">OK</span>
      </template>
      <template #cell-actions="{ row }">
        <div class="actions" style="justify-content:flex-end">
          <button v-if="!row.branch_id" class="btn btn-sm" @click="openMove('income', row)">Asignar</button>
          <template v-else>
            <button class="btn btn-sm" @click="openMove('income', row)">Ingreso</button>
            <button class="btn btn-sm" @click="openMove('outcome', row)">Egreso</button>
            <button class="btn btn-sm" @click="openMove('transfer', row)">Transferir</button>
            <button class="btn btn-sm" @click="openMove('adjustment', row)">Ajustar</button>
          </template>
        </div>
      </template>
    </DataTable>

    <StockMovementModal
      :show="showModal"
      :initial="moveInitial"
      :branches="branches"
      :items="items"
      @close="showModal = false"
      @done="load"
    />
  </div>
</template>
