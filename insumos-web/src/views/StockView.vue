<script>
import { mapState } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import api from '@/services/api'
import DataTable from '@/components/ui/DataTable.vue'
import BaseModal from '@/components/ui/BaseModal.vue'

export default {
  name: 'StockView',
  components: { DataTable, BaseModal },
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
      showModal: false, saving: false,
      form: { type: 'income', itemId: '', branchId: '', originBranchId: '', destinationBranchId: '', quantity: null, newQuantity: null, reason: '' },
    }
  },
  computed: {
    ...mapState(useAuthStore, ['role']),
    canMove() { return this.role === 'admin' || this.role === 'sysadmin' },
    actionColumns() {
      return this.canMove ? [...this.columns, { key: 'actions', label: '', align: 'right' }] : this.columns
    },
  },
  mounted() {
    if (this.$route.query.branchId) this.filters.branchId = this.$route.query.branchId
    this.load(); this.loadBranches(); this.loadItems()
  },
  methods: {
    async load() {
      this.loading = true
      try { const { data } = await api.get('/stock', { params: this.filters }); this.rows = data.data }
      catch (e) { useUiStore().error(e.userMessage) } finally { this.loading = false }
    },
    async loadBranches() { try { const { data } = await api.get('/branches'); this.branches = data.data } catch (e) { /* */ } },
    async loadItems() {
      if (!this.canMove) return
      try { const { data } = await api.get('/items', { params: { limit: 100, status: 'active' } }); this.items = data.data } catch (e) { /* */ }
    },
    isLow(r) { return Number(r.quantity) <= Number(r.minimum_stock) },
    openMove(type, row) {
      this.form = { type, itemId: row?.item_id || '', branchId: row?.branch_id || '', originBranchId: row?.branch_id || '', destinationBranchId: '', quantity: null, newQuantity: row ? Number(row.quantity) : null, reason: '' }
      this.showModal = true
    },
    async submit() {
      this.saving = true
      const f = this.form
      try {
        if (f.type === 'income') await api.post('/stock/income', { itemId: +f.itemId, branchId: +f.branchId, quantity: +f.quantity, reason: f.reason })
        else if (f.type === 'outcome') await api.post('/stock/outcome', { itemId: +f.itemId, branchId: +f.branchId, quantity: +f.quantity, reason: f.reason })
        else if (f.type === 'transfer') await api.post('/stock/transfer', { itemId: +f.itemId, originBranchId: +f.originBranchId, destinationBranchId: +f.destinationBranchId, quantity: +f.quantity, reason: f.reason })
        else if (f.type === 'adjustment') await api.post('/stock/adjustment', { itemId: +f.itemId, branchId: +f.branchId, newQuantity: +f.newQuantity, reason: f.reason })
        useUiStore().success('Movimiento registrado')
        this.showModal = false; this.load()
      } catch (e) { useUiStore().error(e.userMessage) } finally { this.saving = false }
    },
  },
}
</script>

<template>
  <div>
    <div class="page-header">
      <div><h1>Stock disponible</h1><p>Control de existencias por sucursal</p></div>
      <button v-if="canMove" class="btn btn-primary" @click="openMove('income')">+ Nuevo movimiento</button>
    </div>

    <div class="toolbar">
      <input v-model="filters.search" class="input search-input" placeholder="Buscar insumo..." @keyup.enter="load" />
      <select v-model="filters.branchId" class="select" style="max-width:220px" @change="load">
        <option value="">Todas las sucursales</option>
        <option v-for="b in branches" :key="b.id" :value="b.id">{{ b.name }}</option>
      </select>
      <label class="row" style="gap:6px"><input type="checkbox" v-model="filters.lowStock" true-value="true" false-value="" @change="load" /> Solo bajo stock</label>
      <button class="btn" @click="load">Filtrar</button>
    </div>

    <DataTable :columns="actionColumns" :rows="rows" :loading="loading">
      <template #cell-quantity="{ row }">
        <span :style="isLow(row) ? 'color:var(--c-danger);font-weight:600' : ''">{{ row.quantity }} {{ row.unit }}</span>
      </template>
      <template #cell-state="{ row }">
        <span v-if="isLow(row)" class="badge red">Bajo stock</span>
        <span v-else class="badge green">OK</span>
      </template>
      <template #cell-actions="{ row }">
        <div class="actions" style="justify-content:flex-end">
          <button class="btn btn-sm" @click="openMove('income', row)">Ingreso</button>
          <button class="btn btn-sm" @click="openMove('outcome', row)">Egreso</button>
          <button class="btn btn-sm" @click="openMove('transfer', row)">Transferir</button>
          <button class="btn btn-sm" @click="openMove('adjustment', row)">Ajustar</button>
        </div>
      </template>
    </DataTable>

    <BaseModal v-if="showModal" title="Registrar movimiento" @close="showModal = false">
      <div class="field">
        <label>Tipo de movimiento</label>
        <select v-model="form.type" class="select">
          <option value="income">Ingreso</option>
          <option value="outcome">Egreso</option>
          <option value="transfer">Transferencia entre sucursales</option>
          <option value="adjustment">Ajuste manual</option>
        </select>
      </div>
      <div class="field">
        <label>Insumo <span class="req">*</span></label>
        <select v-model="form.itemId" class="select">
          <option value="">Seleccione...</option>
          <option v-for="i in items" :key="i.id" :value="i.id">{{ i.name }}</option>
        </select>
      </div>

      <template v-if="form.type === 'transfer'">
        <div class="field">
          <label>Sucursal origen <span class="req">*</span></label>
          <select v-model="form.originBranchId" class="select">
            <option value="">Seleccione...</option>
            <option v-for="b in branches" :key="b.id" :value="b.id">{{ b.name }}</option>
          </select>
        </div>
        <div class="field">
          <label>Sucursal destino <span class="req">*</span></label>
          <select v-model="form.destinationBranchId" class="select">
            <option value="">Seleccione...</option>
            <option v-for="b in branches" :key="b.id" :value="b.id">{{ b.name }}</option>
          </select>
        </div>
      </template>
      <template v-else>
        <div class="field">
          <label>Sucursal <span class="req">*</span></label>
          <select v-model="form.branchId" class="select">
            <option value="">Seleccione...</option>
            <option v-for="b in branches" :key="b.id" :value="b.id">{{ b.name }}</option>
          </select>
        </div>
      </template>

      <div class="field" v-if="form.type === 'adjustment'">
        <label>Nueva cantidad real <span class="req">*</span></label>
        <input v-model.number="form.newQuantity" class="input" type="number" min="0" step="0.001" />
      </div>
      <div class="field" v-else>
        <label>Cantidad <span class="req">*</span></label>
        <input v-model.number="form.quantity" class="input" type="number" min="0.001" step="0.001" />
      </div>

      <div class="field">
        <label>Motivo / Observación</label>
        <input v-model="form.reason" class="input" />
      </div>

      <template #footer>
        <button class="btn" @click="showModal = false">Cancelar</button>
        <button class="btn btn-primary" :disabled="saving" @click="submit"><span v-if="saving" class="spinner"></span> Registrar</button>
      </template>
    </BaseModal>
  </div>
</template>
