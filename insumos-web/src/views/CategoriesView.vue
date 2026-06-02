<script>
import { useUiStore } from '@/stores/ui'
import api from '@/services/api'
import DataTable from '@/components/ui/DataTable.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import ExportExcelButton from '@/components/ui/ExportExcelButton.vue'

export default {
  name: 'CategoriesView',
  components: { DataTable, BaseModal, StatusBadge, ExportExcelButton },
  data() {
    return {
      rows: [], loading: true,
      columns: [
        { key: 'name', label: 'Nombre' },
        { key: 'description', label: 'Descripción' },
        { key: 'status', label: 'Estado' },
        { key: 'actions', label: '', align: 'right' },
      ],
      showModal: false, saving: false, form: {}, errors: {}, togglingId: null,
    }
  },
  mounted() { this.load() },
  methods: {
    async load() {
      this.loading = true
      try { const { data } = await api.get('/categories'); this.rows = data.data } catch (e) { useUiStore().error(e.userMessage) } finally { this.loading = false }
    },
    openCreate() { this.form = { name: '', description: '' }; this.errors = {}; this.showModal = true },
    openEdit(c) { this.form = { id: c.id, name: c.name, description: c.description, status: c.status }; this.errors = {}; this.showModal = true },
    async save() {
      this.saving = true; this.errors = {}
      try {
        if (this.form.id) { await api.put(`/categories/${this.form.id}`, this.form); useUiStore().success('Categoría actualizada') }
        else { await api.post('/categories', this.form); useUiStore().success('Categoría creada') }
        this.showModal = false; this.load()
      } catch (e) { this.errors = e.details || {}; useUiStore().error(e.userMessage) } finally { this.saving = false }
    },
    async toggle(c) {
      this.togglingId = c.id
      try { await api.delete(`/categories/${c.id}`); useUiStore().success('Categoría desactivada'); await this.load() }
      catch (e) { useUiStore().error(e.userMessage) } finally { this.togglingId = null }
    },
  },
}
</script>

<template>
  <div>
    <div class="page-header">
      <div><h1>Categorías</h1><p>Organiza tus insumos por categoría</p></div>
      <button class="btn btn-primary" @click="openCreate">+ Nueva categoría</button>
    </div>

    <div class="toolbar">
      <div class="spacer"></div>
      <ExportExcelButton path="/export/categories" filename="categorias" />
    </div>

    <DataTable :columns="columns" :rows="rows" :loading="loading">
      <template #cell-status="{ row }"><StatusBadge :status="row.status" /></template>
      <template #cell-actions="{ row }">
        <div class="actions" style="justify-content:flex-end">
          <button class="btn btn-sm" @click="openEdit(row)">Editar</button>
          <button class="btn btn-sm" v-if="row.status === 'active'" :disabled="togglingId === row.id" @click="toggle(row)">
            <span v-if="togglingId === row.id" class="spinner dark"></span> Desactivar
          </button>
        </div>
      </template>
    </DataTable>

    <BaseModal v-if="showModal" :title="form.id ? 'Editar categoría' : 'Nueva categoría'" @close="showModal = false">
      <div class="field">
        <label>Nombre <span class="req">*</span></label>
        <input v-model="form.name" class="input" />
        <div v-if="errors.name" class="field-error">{{ errors.name }}</div>
      </div>
      <div class="field">
        <label>Descripción</label>
        <textarea v-model="form.description" class="textarea"></textarea>
      </div>
      <template #footer>
        <button class="btn" @click="showModal = false">Cancelar</button>
        <button class="btn btn-primary" :disabled="saving" @click="save"><span v-if="saving" class="spinner"></span> Guardar</button>
      </template>
    </BaseModal>
  </div>
</template>
