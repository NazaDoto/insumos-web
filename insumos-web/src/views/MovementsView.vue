<script>
import { useUiStore } from '@/stores/ui'
import api from '@/services/api'
import DataTable from '@/components/ui/DataTable.vue'
import Pagination from '@/components/ui/Pagination.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import BaseModal from '@/components/ui/BaseModal.vue'

export default {
  name: 'MovementsView',
  components: { DataTable, Pagination, StatusBadge, BaseModal },
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
      showModal: false, saving: false,
      form: { type: 'income', itemId: '', branchId: '', originBranchId: '', destinationBranchId: '', quantity: null, newQuantity: null, reason: '' },
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
      this.form = { type: 'income', itemId: '', branchId: '', originBranchId: '', destinationBranchId: '', quantity: null, newQuantity: null, reason: '' }
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
        this.showModal = false; this.page = 1; this.load()
      } catch (e) { useUiStore().error(e.userMessage) } finally { this.saving = false }
    },
  },
}
</script>

<template>
  <div>
    <div class="page-header">
      <div><h1>Movimientos de stock</h1><p>Trazabilidad completa de ingresos, egresos y transferencias</p></div>
      <button class="btn btn-primary" @click="openMove">+ Nuevo movimiento</button>
    </div>

    <div class="toolbar">
      <select v-model="filters.type" class="select" style="max-width:180px" @change="onFilter">
        <option value="">Todos los tipos</option>
        <option v-for="t in types" :key="t.v" :value="t.v">{{ t.l }}</option>
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
        <label>Motivo / Observacion</label>
        <input v-model="form.reason" class="input" />
      </div>

      <template #footer>
        <button class="btn" @click="showModal = false">Cancelar</button>
        <button class="btn btn-primary" :disabled="saving" @click="submit"><span v-if="saving" class="spinner"></span> Registrar</button>
      </template>
    </BaseModal>
  </div>
</template>
