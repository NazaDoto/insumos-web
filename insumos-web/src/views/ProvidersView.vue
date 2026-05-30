<script>
import { useUiStore } from '@/stores/ui'
import api from '@/services/api'
import DataTable from '@/components/ui/DataTable.vue'
import BaseModal from '@/components/ui/BaseModal.vue'

export default {
  name: 'ProvidersView',
  components: { DataTable, BaseModal },
  data() {
    return {
      rows: [], loading: true, search: '',
      columns: [
        { key: 'name', label: 'Proveedor' },
        { key: 'email', label: 'Email' },
        { key: 'phone', label: 'Telefono' },
        { key: 'items_count', label: 'Insumos', align: 'right' },
        { key: 'actions', label: '', align: 'right' },
      ],
      catalog: null, catalogItems: [], catalogLoading: false,
    }
  },
  mounted() { this.load() },
  methods: {
    async load() {
      this.loading = true
      try { const { data } = await api.get('/providers', { params: { search: this.search } }); this.rows = data.data }
      catch (e) { useUiStore().error(e.userMessage) } finally { this.loading = false }
    },
    async openCatalog(p) {
      this.catalog = p; this.catalogLoading = true; this.catalogItems = []
      try { const { data } = await api.get(`/providers/${p.id}/items`); this.catalogItems = data.data }
      catch (e) { useUiStore().error(e.userMessage) } finally { this.catalogLoading = false }
    },
  },
}
</script>

<template>
  <div>
    <div class="page-header"><div><h1>Proveedores</h1><p>Catalogo de proveedores y sus insumos</p></div></div>

    <div class="toolbar">
      <input v-model="search" class="input search-input" placeholder="Buscar proveedor..." @keyup.enter="load" />
      <button class="btn" @click="load">Buscar</button>
    </div>

    <DataTable :columns="columns" :rows="rows" :loading="loading">
      <template #cell-name="{ row }">{{ row.first_name }} {{ row.last_name }}</template>
      <template #cell-phone="{ row }">{{ row.phone || '-' }}</template>
      <template #cell-actions="{ row }">
        <div class="actions" style="justify-content:flex-end">
          <button class="btn btn-sm" @click="openCatalog(row)">Ver catalogo</button>
          <RouterLink :to="`/orders/new?providerId=${row.id}`" class="btn btn-sm btn-primary">Hacer pedido</RouterLink>
        </div>
      </template>
    </DataTable>

    <BaseModal v-if="catalog" large :title="`Catalogo de ${catalog.first_name} ${catalog.last_name}`" @close="catalog = null">
      <div v-if="catalogLoading" class="loading-center"><span class="spinner dark"></span></div>
      <table v-else class="data">
        <thead><tr><th>Insumo</th><th>Categoria</th><th>Unidad</th><th class="text-right">Disponible</th></tr></thead>
        <tbody>
          <tr v-for="i in catalogItems" :key="i.id">
            <td style="font-weight:550">{{ i.name }}</td>
            <td>{{ i.category || '-' }}</td>
            <td>{{ i.unit }}</td>
            <td class="text-right">{{ i.available }}</td>
          </tr>
          <tr v-if="!catalogItems.length"><td colspan="4" class="table-empty">Sin insumos publicados</td></tr>
        </tbody>
      </table>
      <template #footer>
        <RouterLink :to="`/orders/new?providerId=${catalog.id}`" class="btn btn-primary">Crear pedido a este proveedor</RouterLink>
      </template>
    </BaseModal>
  </div>
</template>
