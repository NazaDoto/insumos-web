<script>
import { useUiStore } from '@/stores/ui'
import api from '@/services/api'
import DataTable from '@/components/ui/DataTable.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'

export default {
  name: 'CategoriesView',
  components: { DataTable, BaseModal, StatusBadge },
  data() {
    return {
      rows: [], loading: true,
      columns: [
        { key: 'name', label: 'Nombre' },
        { key: 'description', label: 'Descripcion' },
        { key: 'status', label: 'Estado' },
        { key: 'actions', label: '', align: 'right' },
      ],
      showModal: false, saving: false, form: {}, errors: {},
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
        if (this.form.id) { await api.put(`/categories/${this.form.id}`, this.form); useUiStore().success('Categoria actualizada') }
        else { await api.post('/categories', this.form); useUiStore().success('Categoria creada') }
        this.showModal = false; this.load()
      } catch (e) { this.errors = e.details || {}; useUiStore().error(e.userMessage) } finally { this.saving = false }
    },
    async toggle(c) {
      try { await api.delete(`/categories/${c.id}`); useUiStore().success('Categoria desactivada'); this.load() }
      catch (e) { useUiStore().error(e.userMessage) }
    },
  },
}
</script>

<template>
  <div>
    <div class="page-header">
      <div><h1>Categorias</h1><p>Organiza tus insumos por categoria</p></div>
      <button class="btn btn-primary" @click="openCreate">+ Nueva categoria</button>
    </div>

    <DataTable :columns="columns" :rows="rows" :loading="loading">
      <template #cell-status="{ row }"><StatusBadge :status="row.status" /></template>
      <template #cell-actions="{ row }">
        <div class="actions" style="justify-content:flex-end">
          <button class="btn btn-sm" @click="openEdit(row)">Editar</button>
          <button class="btn btn-sm" @click="toggle(row)" v-if="row.status === 'active'">Desactivar</button>
        </div>
      </template>
    </DataTable>

    <BaseModal v-if="showModal" :title="form.id ? 'Editar categoria' : 'Nueva categoria'" @close="showModal = false">
      <div class="field">
        <label>Nombre <span class="req">*</span></label>
        <input v-model="form.name" class="input" />
        <div v-if="errors.name" class="field-error">{{ errors.name }}</div>
      </div>
      <div class="field">
        <label>Descripcion</label>
        <textarea v-model="form.description" class="textarea"></textarea>
      </div>
      <template #footer>
        <button class="btn" @click="showModal = false">Cancelar</button>
        <button class="btn btn-primary" :disabled="saving" @click="save"><span v-if="saving" class="spinner"></span> Guardar</button>
      </template>
    </BaseModal>
  </div>
</template>
