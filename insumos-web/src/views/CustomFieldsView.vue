<script>
import { useUiStore } from '@/stores/ui'
import api from '@/services/api'
import DataTable from '@/components/ui/DataTable.vue'
import BaseModal from '@/components/ui/BaseModal.vue'

const MODULES = [
  { v: 'items', l: 'Insumos' }, { v: 'usage', l: 'Uso de insumos' },
  { v: 'branches', l: 'Sucursales' }, { v: 'orders', l: 'Pedidos' }, { v: 'movements', l: 'Movimientos' },
]
const TYPES = [
  { v: 'text', l: 'Texto corto' }, { v: 'textarea', l: 'Texto largo' }, { v: 'number', l: 'Numero' },
  { v: 'date', l: 'Fecha' }, { v: 'boolean', l: 'Si/No' }, { v: 'select', l: 'Lista desplegable' },
]

export default {
  name: 'CustomFieldsView',
  components: { DataTable, BaseModal },
  data() {
    return {
      rows: [], loading: true, moduleFilter: '',
      MODULES, TYPES,
      columns: [
        { key: 'field_label', label: 'Etiqueta' },
        { key: 'module', label: 'Modulo' },
        { key: 'field_type', label: 'Tipo' },
        { key: 'is_required', label: 'Obligatorio' },
        { key: 'is_active', label: 'Activo' },
        { key: 'actions', label: '', align: 'right' },
      ],
      showModal: false, saving: false, form: {}, errors: {}, optionsText: '',
    }
  },
  mounted() { this.load() },
  methods: {
    moduleLabel(v) { return MODULES.find(m => m.v === v)?.l || v },
    typeLabel(v) { return TYPES.find(t => t.v === v)?.l || v },
    async load() {
      this.loading = true
      try { const { data } = await api.get('/custom-fields', { params: { module: this.moduleFilter } }); this.rows = data.data }
      catch (e) { useUiStore().error(e.userMessage) } finally { this.loading = false }
    },
    openCreate() {
      this.form = { module: 'items', fieldName: '', fieldLabel: '', fieldType: 'text', isRequired: false }
      this.optionsText = ''; this.errors = {}; this.showModal = true
    },
    openEdit(f) {
      this.form = { id: f.id, module: f.module, fieldName: f.field_name, fieldLabel: f.field_label, fieldType: f.field_type, isRequired: !!f.is_required, isActive: !!f.is_active }
      this.optionsText = (f.options || []).map(o => o.label).join('\n')
      this.errors = {}; this.showModal = true
    },
    async save() {
      this.saving = true; this.errors = {}
      try {
        const payload = { ...this.form }
        if (this.form.fieldType === 'select') {
          payload.options = this.optionsText.split('\n').map(s => s.trim()).filter(Boolean).map(s => ({ value: s, label: s }))
        }
        if (this.form.id) { await api.put(`/custom-fields/${this.form.id}`, payload); useUiStore().success('Atributo actualizado') }
        else { await api.post('/custom-fields', payload); useUiStore().success('Atributo creado') }
        this.showModal = false; this.load()
      } catch (e) { this.errors = e.details || {}; useUiStore().error(e.userMessage) } finally { this.saving = false }
    },
    async remove(f) {
      try { await api.delete(`/custom-fields/${f.id}`); useUiStore().success('Atributo desactivado'); this.load() }
      catch (e) { useUiStore().error(e.userMessage) }
    },
  },
}
</script>

<template>
  <div>
    <div class="page-header">
      <div><h1>Atributos personalizados</h1><p>Define campos dinamicos sin tocar el codigo</p></div>
      <button class="btn btn-primary" @click="openCreate">+ Nuevo atributo</button>
    </div>

    <div class="toolbar">
      <select v-model="moduleFilter" class="select" style="max-width:200px" @change="load">
        <option value="">Todos los modulos</option>
        <option v-for="m in MODULES" :key="m.v" :value="m.v">{{ m.l }}</option>
      </select>
    </div>

    <DataTable :columns="columns" :rows="rows" :loading="loading">
      <template #cell-module="{ row }"><span class="badge blue">{{ moduleLabel(row.module) }}</span></template>
      <template #cell-field_type="{ row }">{{ typeLabel(row.field_type) }}</template>
      <template #cell-is_required="{ row }"><span :class="['badge', row.is_required ? 'amber' : 'gray']">{{ row.is_required ? 'Si' : 'No' }}</span></template>
      <template #cell-is_active="{ row }"><span :class="['badge', row.is_active ? 'green' : 'gray']">{{ row.is_active ? 'Activo' : 'Inactivo' }}</span></template>
      <template #cell-actions="{ row }">
        <div class="actions" style="justify-content:flex-end">
          <button class="btn btn-sm" @click="openEdit(row)">Editar</button>
          <button class="btn btn-sm" v-if="row.is_active" @click="remove(row)">Desactivar</button>
        </div>
      </template>
    </DataTable>

    <BaseModal v-if="showModal" :title="form.id ? 'Editar atributo' : 'Nuevo atributo'" @close="showModal = false">
      <div class="form-grid">
        <div class="field">
          <label>Modulo <span class="req">*</span></label>
          <select v-model="form.module" class="select" :disabled="!!form.id">
            <option v-for="m in MODULES" :key="m.v" :value="m.v">{{ m.l }}</option>
          </select>
        </div>
        <div class="field">
          <label>Tipo <span class="req">*</span></label>
          <select v-model="form.fieldType" class="select" :disabled="!!form.id">
            <option v-for="t in TYPES" :key="t.v" :value="t.v">{{ t.l }}</option>
          </select>
        </div>
        <div class="field">
          <label>Nombre interno <span class="req">*</span></label>
          <input v-model="form.fieldName" class="input" :disabled="!!form.id" placeholder="serie, marca, color..." />
          <div v-if="errors.fieldName" class="field-error">{{ errors.fieldName }}</div>
        </div>
        <div class="field">
          <label>Etiqueta visible <span class="req">*</span></label>
          <input v-model="form.fieldLabel" class="input" />
          <div v-if="errors.fieldLabel" class="field-error">{{ errors.fieldLabel }}</div>
        </div>
      </div>
      <div class="field" v-if="form.fieldType === 'select'">
        <label>Opciones (una por linea)</label>
        <textarea v-model="optionsText" class="textarea" placeholder="Opcion 1&#10;Opcion 2"></textarea>
      </div>
      <label class="row" style="gap:8px"><input type="checkbox" v-model="form.isRequired" /> Campo obligatorio</label>
      <label v-if="form.id" class="row mt-2" style="gap:8px"><input type="checkbox" v-model="form.isActive" /> Activo</label>
      <template #footer>
        <button class="btn" @click="showModal = false">Cancelar</button>
        <button class="btn btn-primary" :disabled="saving" @click="save"><span v-if="saving" class="spinner"></span> Guardar</button>
      </template>
    </BaseModal>
  </div>
</template>
