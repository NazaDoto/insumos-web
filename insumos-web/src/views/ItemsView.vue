<script>
import { useUiStore } from '@/stores/ui'
import api from '@/services/api'
import DataTable from '@/components/ui/DataTable.vue'
import Pagination from '@/components/ui/Pagination.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import ItemsImportModal from '@/components/items/ItemsImportModal.vue'
import ExportExcelButton from '@/components/ui/ExportExcelButton.vue'
import BaseModal from '@/components/ui/BaseModal.vue'

export default {
  name: 'ItemsView',
  components: { DataTable, Pagination, StatusBadge, ConfirmDialog, ItemsImportModal, ExportExcelButton, BaseModal },
  data() {
    return {
      rows: [], meta: {}, loading: true, page: 1,
      filters: { search: '', categoryId: '', lowStock: '' },
      categories: [],
      columns: [
        { key: 'name', label: 'Insumo' },
        { key: 'category', label: 'Categoría' },
        { key: 'unassignedStock', label: 'Sin asignar', align: 'right' },
        { key: 'assignedStock', label: 'En sucursales', align: 'right' },
        { key: 'unit', label: 'Unidad' },
        { key: 'status', label: 'Estado' },
        { key: 'actions', label: '', align: 'right' },
      ],
      confirm: null, deleting: false,
      showImport: false,
      stockModal: null,
      stockQty: null,
      stockSaving: false,
    }
  },
  mounted() { this.load(); this.loadCategories() },
  methods: {
    async load() {
      this.loading = true
      try {
        const { data } = await api.get('/items', { params: { ...this.filters, page: this.page, limit: 20 } })
        this.rows = data.data
        this.meta = data.meta
      } catch (e) { useUiStore().error(e.userMessage) } finally { this.loading = false }
    },
    async loadCategories() {
      try { const { data } = await api.get('/categories'); this.categories = data.data } catch (e) { /* */ }
    },
    async refreshAfterImport() {
      this.page = 1
      await Promise.all([this.load(), this.loadCategories()])
    },
    onSearch() { this.page = 1; this.load() },
    changePage(p) { this.page = p; this.load() },
    isLow(r) { return Number(r.totalStock) <= Number(r.minimumStock) },
    openStock(r) {
      this.stockModal = r
      this.stockQty = Number(r.unassignedStock ?? 0)
    },
    async saveStock() {
      if (!this.stockModal) return
      this.stockSaving = true
      try {
        await api.patch(`/items/${this.stockModal.id}/unassigned-stock`, {
          quantity: Number(this.stockQty),
          reason: 'Ajuste desde listado de insumos',
        })
        useUiStore().success('Stock sin asignar actualizado')
        this.stockModal = null
        await this.load()
      } catch (e) { useUiStore().error(e.userMessage) } finally { this.stockSaving = false }
    },
    askDelete(r) { this.confirm = r },
    async doDelete() {
      this.deleting = true
      try {
        await api.delete(`/items/${this.confirm.id}`)
        useUiStore().success('Insumo desactivado')
        this.confirm = null
        await this.load()
      } catch (e) { useUiStore().error(e.userMessage) } finally { this.deleting = false }
    },
  },
}
</script>

<template>
  <div>
    <div class="page-header">
      <div><h1>Insumos</h1><p>Administra tus insumos y su stock</p></div>
      <div class="row">
        <button type="button" class="btn" @click="showImport = true">Importar Excel</button>
        <RouterLink to="/items/new" class="btn btn-primary">+ Nuevo insumo</RouterLink>
      </div>
    </div>

    <div class="toolbar">
      <input v-model="filters.search" class="input search-input" placeholder="Buscar insumo..." @keyup.enter="onSearch" />
      <select v-model="filters.categoryId" class="select" style="max-width:200px" @change="onSearch">
        <option value="">Todas las categorías</option>
        <option v-for="c in categories" :key="c.id" :value="c.id">{{ c.name }}</option>
      </select>
      <label class="row" style="gap:6px"><input type="checkbox" v-model="filters.lowStock" true-value="true" false-value="" @change="onSearch" /> Solo bajo stock</label>
      <button class="btn" @click="onSearch">Buscar</button>
      <div class="spacer"></div>
      <ExportExcelButton path="/export/items" :params="filters" filename="insumos" />
    </div>

    <DataTable :columns="columns" :rows="rows" :loading="loading">
      <template #cell-name="{ row }">
        <RouterLink :to="`/items/${row.id}`" style="font-weight:600;color:var(--c-primary)">{{ row.name }}</RouterLink>
      </template>
      <template #cell-unassignedStock="{ row }">
        <span :style="isLow(row) ? 'color:var(--c-danger);font-weight:600' : ''">{{ row.unassignedStock ?? 0 }}</span>
        <span v-if="isLow(row)" class="badge red" style="margin-left:6px">Bajo</span>
      </template>
      <template #cell-assignedStock="{ row }">{{ row.assignedStock ?? 0 }}</template>
      <template #cell-totalStock="{ row }">
        <span class="muted">{{ row.totalStock ?? 0 }}</span>
      </template>
      <template #cell-status="{ row }"><StatusBadge :status="row.status" /></template>
      <template #cell-actions="{ row }">
        <div class="actions" style="justify-content:flex-end">
          <button type="button" class="btn btn-sm" @click="openStock(row)">Stock</button>
          <RouterLink :to="`/items/${row.id}`" class="btn btn-sm">Ver</RouterLink>
          <RouterLink :to="`/items/${row.id}/edit`" class="btn btn-sm">Editar</RouterLink>
          <button class="btn btn-sm" @click="askDelete(row)">Baja</button>
        </div>
      </template>
      <template #footer><Pagination :meta="meta" @change="changePage" /></template>
    </DataTable>

    <ItemsImportModal
      v-if="showImport"
      @close="showImport = false"
      @done="refreshAfterImport"
    />

    <ConfirmDialog v-if="confirm" danger title="Dar de baja insumo"
      :message="`¿Desea desactivar el insumo \u201C${confirm.name}\u201D?`" confirm-text="Desactivar"
      :loading="deleting" @confirm="doDelete" @cancel="confirm = null" />

    <BaseModal v-if="stockModal" :title="`Stock sin asignar — ${stockModal.name}`" @close="stockModal = null">
      <p class="muted" style="margin-bottom:12px">
        En sucursales: <strong>{{ stockModal.assignedStock ?? 0 }}</strong> {{ stockModal.unit }}.
        El cambio aquí registra un ingreso o egreso al pool sin asignar.
      </p>
      <div class="field">
        <label>Cantidad sin asignar <span class="req">*</span></label>
        <input v-model.number="stockQty" class="input" type="number" min="0" step="0.001" />
      </div>
      <template #footer>
        <button type="button" class="btn" @click="stockModal = null">Cancelar</button>
        <button type="button" class="btn btn-primary" :disabled="stockSaving" @click="saveStock">
          <span v-if="stockSaving" class="spinner"></span> Guardar
        </button>
      </template>
    </BaseModal>
  </div>
</template>
