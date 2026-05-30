<script>
import { useUiStore } from '@/stores/ui'
import api from '@/services/api'
import DataTable from '@/components/ui/DataTable.vue'
import Pagination from '@/components/ui/Pagination.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'

export default {
  name: 'ItemsView',
  components: { DataTable, Pagination, StatusBadge, ConfirmDialog },
  data() {
    return {
      rows: [], meta: {}, loading: true, page: 1,
      filters: { search: '', categoryId: '', lowStock: '' },
      categories: [],
      columns: [
        { key: 'name', label: 'Insumo' },
        { key: 'category', label: 'Categoria' },
        { key: 'totalStock', label: 'Stock', align: 'right' },
        { key: 'unit', label: 'Unidad' },
        { key: 'status', label: 'Estado' },
        { key: 'actions', label: '', align: 'right' },
      ],
      confirm: null,
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
    onSearch() { this.page = 1; this.load() },
    changePage(p) { this.page = p; this.load() },
    isLow(r) { return Number(r.totalStock) <= Number(r.minimumStock) },
    askDelete(r) { this.confirm = r },
    async doDelete() {
      try {
        await api.delete(`/items/${this.confirm.id}`)
        useUiStore().success('Insumo desactivado')
        this.confirm = null
        this.load()
      } catch (e) { useUiStore().error(e.userMessage) }
    },
  },
}
</script>

<template>
  <div>
    <div class="page-header">
      <div><h1>Insumos</h1><p>Administra tus insumos y su stock</p></div>
      <RouterLink to="/items/new" class="btn btn-primary">+ Nuevo insumo</RouterLink>
    </div>

    <div class="toolbar">
      <input v-model="filters.search" class="input search-input" placeholder="Buscar insumo..." @keyup.enter="onSearch" />
      <select v-model="filters.categoryId" class="select" style="max-width:200px" @change="onSearch">
        <option value="">Todas las categorias</option>
        <option v-for="c in categories" :key="c.id" :value="c.id">{{ c.name }}</option>
      </select>
      <label class="row" style="gap:6px"><input type="checkbox" v-model="filters.lowStock" true-value="true" false-value="" @change="onSearch" /> Solo bajo stock</label>
      <button class="btn" @click="onSearch">Buscar</button>
    </div>

    <DataTable :columns="columns" :rows="rows" :loading="loading">
      <template #cell-name="{ row }">
        <RouterLink :to="`/items/${row.id}`" style="font-weight:600;color:var(--c-primary)">{{ row.name }}</RouterLink>
      </template>
      <template #cell-totalStock="{ row }">
        <span :style="isLow(row) ? 'color:var(--c-danger);font-weight:600' : ''">{{ row.totalStock }}</span>
        <span v-if="isLow(row)" class="badge red" style="margin-left:6px">Bajo</span>
      </template>
      <template #cell-status="{ row }"><StatusBadge :status="row.status" /></template>
      <template #cell-actions="{ row }">
        <div class="actions" style="justify-content:flex-end">
          <RouterLink :to="`/items/${row.id}`" class="btn btn-sm">Ver</RouterLink>
          <RouterLink :to="`/items/${row.id}/edit`" class="btn btn-sm">Editar</RouterLink>
          <button class="btn btn-sm" @click="askDelete(row)">Baja</button>
        </div>
      </template>
      <template #footer><Pagination :meta="meta" @change="changePage" /></template>
    </DataTable>

    <ConfirmDialog v-if="confirm" danger title="Dar de baja insumo"
      :message="`Desea desactivar el insumo \u201C${confirm.name}\u201D?`" confirm-text="Desactivar"
      @confirm="doDelete" @cancel="confirm = null" />
  </div>
</template>
