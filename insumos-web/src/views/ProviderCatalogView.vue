<script>
import { useUiStore } from '@/stores/ui'
import api from '@/services/api'
import DataTable from '@/components/ui/DataTable.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'

export default {
  name: 'ProviderCatalogView',
  components: { DataTable, BaseModal, StatusBadge },
  data() {
    return {
      rows: [], loading: true,
      columns: [
        { key: 'name', label: 'Insumo' },
        { key: 'category', label: 'Categoría' },
        { key: 'available', label: 'Stock disponible', align: 'right' },
        { key: 'unit', label: 'Unidad' },
        { key: 'status', label: 'Estado' },
        { key: 'actions', label: '', align: 'right' },
      ],
      categories: [],
      showModal: false, saving: false, form: {}, errors: {}, removingId: null,
    }
  },
  mounted() { this.load(); this.loadCategories() },
  methods: {
    async load() {
      this.loading = true
      try { const { data } = await api.get('/provider/items'); this.rows = data.data }
      catch (e) { useUiStore().error(e.userMessage) } finally { this.loading = false }
    },
    async loadCategories() { try { const { data } = await api.get('/categories'); this.categories = data.data } catch (e) { /* */ } },
    openCreate() { this.form = { name: '', description: '', unit: 'unidad', minimumStock: 0, categoryId: '', quantity: 0 }; this.errors = {}; this.showModal = true },
    openEdit(i) { this.form = { id: i.id, name: i.name, description: i.description, unit: i.unit, minimumStock: i.minimum_stock, categoryId: i.category_id || '', quantity: Number(i.available), status: i.status }; this.errors = {}; this.showModal = true },
    async save() {
      this.saving = true; this.errors = {}
      try {
        const payload = { ...this.form }
        if (!payload.categoryId) payload.categoryId = null
        if (this.form.id) { await api.put(`/provider/items/${this.form.id}`, payload); useUiStore().success('Insumo actualizado') }
        else { await api.post('/provider/items', payload); useUiStore().success('Insumo creado') }
        this.showModal = false; this.load()
      } catch (e) { this.errors = e.details || {}; useUiStore().error(e.userMessage) } finally { this.saving = false }
    },
    async remove(i) {
      this.removingId = i.id
      try { await api.delete(`/provider/items/${i.id}`); useUiStore().success('Insumo desactivado'); await this.load() }
      catch (e) { useUiStore().error(e.userMessage) } finally { this.removingId = null }
    },
  },
}
</script>

<template>
  <div>
    <div class="page-header">
      <div><h1>Mi stock</h1><p>Administra tu catalogo de insumos disponibles</p></div>
      <button class="btn btn-primary" @click="openCreate">+ Nuevo insumo</button>
    </div>

    <DataTable :columns="columns" :rows="rows" :loading="loading">
      <template #cell-category="{ row }">{{ row.category || '-' }}</template>
      <template #cell-status="{ row }"><StatusBadge :status="row.status" /></template>
      <template #cell-actions="{ row }">
        <div class="actions" style="justify-content:flex-end">
          <button class="btn btn-sm" @click="openEdit(row)">Editar</button>
          <button class="btn btn-sm" v-if="row.status === 'active'" :disabled="removingId === row.id" @click="remove(row)">
            <span v-if="removingId === row.id" class="spinner dark"></span> Baja
          </button>
        </div>
      </template>
    </DataTable>

    <BaseModal v-if="showModal" :title="form.id ? 'Editar insumo' : 'Nuevo insumo'" @close="showModal = false">
      <div class="form-grid">
        <div class="field">
          <label>Nombre <span class="req">*</span></label>
          <input v-model="form.name" class="input" />
          <div v-if="errors.name" class="field-error">{{ errors.name }}</div>
        </div>
        <div class="field">
          <label>Categoría</label>
          <select v-model="form.categoryId" class="select">
            <option value="">Sin categoría</option>
            <option v-for="c in categories" :key="c.id" :value="c.id">{{ c.name }}</option>
          </select>
        </div>
        <div class="field"><label>Unidad</label><input v-model="form.unit" class="input" /></div>
        <div class="field"><label>Stock disponible</label><input v-model.number="form.quantity" class="input" type="number" min="0" step="0.001" /></div>
        <div class="field"><label>Stock mínimo</label><input v-model.number="form.minimumStock" class="input" type="number" min="0" step="0.001" /></div>
      </div>
      <div class="field"><label>Descripción</label><textarea v-model="form.description" class="textarea"></textarea></div>
      <template #footer>
        <button class="btn" @click="showModal = false">Cancelar</button>
        <button class="btn btn-primary" :disabled="saving" @click="save"><span v-if="saving" class="spinner"></span> Guardar</button>
      </template>
    </BaseModal>
  </div>
</template>
