<script>
import { useUiStore } from '@/stores/ui'
import api from '@/services/api'

export default {
  name: 'ItemFormView',
  data() {
    return {
      loading: false, saving: false,
      form: { name: '', description: '', unit: 'unidad', minimumStock: 0, categoryId: '', conditionState: 'available' },
      categories: [],
      customFields: [],
      customValues: {},
      conditions: [
        { v: 'available', l: 'Disponible' }, { v: 'in_use', l: 'En uso' }, { v: 'repair', l: 'En reparacion' },
        { v: 'damaged', l: 'Dañado' }, { v: 'reserved', l: 'Reservado' }, { v: 'retired', l: 'Dado de baja' },
      ],
      errors: {},
    }
  },
  computed: {
    id() { return this.$route.params.id },
    isEdit() { return !!this.id },
  },
  mounted() {
    this.loadCategories()
    this.loadCustomFields()
    if (this.isEdit) this.loadItem()
  },
  methods: {
    async loadCategories() {
      try { const { data } = await api.get('/categories'); this.categories = data.data.filter(c => c.status === 'active') } catch (e) { /* */ }
    },
    async loadCustomFields() {
      try { const { data } = await api.get('/custom-fields/module/items'); this.customFields = data.data } catch (e) { /* */ }
    },
    async loadItem() {
      this.loading = true
      try {
        const { data } = await api.get(`/items/${this.id}`)
        const it = data.data
        this.form = {
          name: it.name, description: it.description, unit: it.unit,
          minimumStock: it.minimumStock, categoryId: it.categoryId || '', conditionState: it.conditionState,
        }
        for (const cv of it.customValues || []) {
          if (cv.value !== null) this.customValues[cv.field_id] = cv.value
        }
      } catch (e) { useUiStore().error(e.userMessage) } finally { this.loading = false }
    },
    async save() {
      this.saving = true; this.errors = {}
      try {
        const payload = { ...this.form, customValues: this.customValues }
        if (!payload.categoryId) payload.categoryId = null
        if (this.isEdit) {
          await api.put(`/items/${this.id}`, payload)
          useUiStore().success('Insumo actualizado')
        } else {
          await api.post('/items', payload)
          useUiStore().success('Insumo creado')
        }
        this.$router.push('/items')
      } catch (e) {
        this.errors = e.details || {}
        useUiStore().error(e.userMessage)
      } finally { this.saving = false }
    },
  },
}
</script>

<template>
  <div>
    <div class="page-header">
      <div><h1>{{ isEdit ? 'Editar insumo' : 'Nuevo insumo' }}</h1></div>
      <RouterLink to="/items" class="btn">Volver</RouterLink>
    </div>

    <div v-if="loading" class="loading-center"><span class="spinner dark"></span></div>

    <form v-else class="card card-pad" style="max-width:760px" @submit.prevent="save">
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
        <div class="field">
          <label>Unidad de medida</label>
          <input v-model="form.unit" class="input" placeholder="unidad, caja, litro..." />
        </div>
        <div class="field">
          <label>Stock mínimo</label>
          <input v-model.number="form.minimumStock" class="input" type="number" min="0" step="0.001" />
        </div>
        <div class="field">
          <label>Estado fisico</label>
          <select v-model="form.conditionState" class="select">
            <option v-for="c in conditions" :key="c.v" :value="c.v">{{ c.l }}</option>
          </select>
        </div>
      </div>
      <div class="field">
        <label>Descripción</label>
        <textarea v-model="form.description" class="textarea"></textarea>
      </div>

      <template v-if="customFields.length">
        <h3 class="mb-4 mt-2">Atributos personalizados</h3>
        <div class="form-grid">
          <div class="field" v-for="f in customFields" :key="f.id">
            <label>{{ f.field_label }} <span v-if="f.is_required" class="req">*</span></label>
            <select v-if="f.field_type === 'select'" v-model="customValues[f.id]" class="select">
              <option value="">Seleccione...</option>
              <option v-for="o in f.options" :key="o.id" :value="o.value">{{ o.label }}</option>
            </select>
            <textarea v-else-if="f.field_type === 'textarea'" v-model="customValues[f.id]" class="textarea"></textarea>
            <input v-else-if="f.field_type === 'number'" v-model="customValues[f.id]" class="input" type="number" />
            <input v-else-if="f.field_type === 'date'" v-model="customValues[f.id]" class="input" type="date" />
            <select v-else-if="f.field_type === 'boolean'" v-model="customValues[f.id]" class="select">
              <option value="">-</option><option value="1">Si</option><option value="0">No</option>
            </select>
            <input v-else v-model="customValues[f.id]" class="input" />
          </div>
        </div>
      </template>

      <div class="row mt-4">
        <button class="btn btn-primary" type="submit" :disabled="saving">
          <span v-if="saving" class="spinner"></span> Guardar
        </button>
        <RouterLink to="/items" class="btn">Cancelar</RouterLink>
      </div>
    </form>
  </div>
</template>
