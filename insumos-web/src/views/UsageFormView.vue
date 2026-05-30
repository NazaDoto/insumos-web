<script>
import { useUiStore } from '@/stores/ui'
import api from '@/services/api'

export default {
  name: 'UsageFormView',
  data() {
    return {
      branches: [], stockItems: [], customFields: [], customValues: {},
      form: { branchId: '', itemId: '', quantity: null, usedWhere: '', usedFor: '', recipient: '', observations: '' },
      saving: false,
    }
  },
  computed: {
    selectedItem() { return this.stockItems.find(s => s.item_id === Number(this.form.itemId)) },
    available() { return this.selectedItem ? Number(this.selectedItem.quantity) : null },
  },
  mounted() { this.loadBranches(); this.loadCustomFields() },
  methods: {
    async loadBranches() { try { const { data } = await api.get('/branches'); this.branches = data.data } catch (e) { useUiStore().error(e.userMessage) } },
    async loadCustomFields() { try { const { data } = await api.get('/custom-fields/module/usage'); this.customFields = data.data } catch (e) { /* */ } },
    async onBranchChange() {
      this.form.itemId = ''; this.stockItems = []
      if (!this.form.branchId) return
      try { const { data } = await api.get('/stock', { params: { branchId: this.form.branchId } }); this.stockItems = data.data }
      catch (e) { useUiStore().error(e.userMessage) }
    },
    async submit() {
      if (!this.form.branchId || !this.form.itemId || !this.form.quantity) return useUiStore().warning('Complete los campos obligatorios')
      if (this.available !== null && this.form.quantity > this.available) return useUiStore().warning('Cantidad superior al stock disponible')
      this.saving = true
      try {
        await api.post('/usage', {
          itemId: Number(this.form.itemId), branchId: Number(this.form.branchId), quantity: Number(this.form.quantity),
          usedWhere: this.form.usedWhere, usedFor: this.form.usedFor, recipient: this.form.recipient,
          observations: this.form.observations, customValues: this.customValues,
        })
        useUiStore().success('Uso registrado')
        this.$router.push('/usage')
      } catch (e) { useUiStore().error(e.userMessage) } finally { this.saving = false }
    },
  },
}
</script>

<template>
  <div>
    <div class="page-header">
      <div><h1>Registrar uso de insumo</h1><p>Indica el insumo utilizado y los detalles</p></div>
      <RouterLink to="/usage" class="btn">Volver</RouterLink>
    </div>

    <form class="card card-pad" style="max-width:720px" @submit.prevent="submit">
      <div class="form-grid">
        <div class="field">
          <label>Sucursal <span class="req">*</span></label>
          <select v-model="form.branchId" class="select" @change="onBranchChange">
            <option value="">Seleccione...</option>
            <option v-for="b in branches" :key="b.id" :value="b.id">{{ b.name }}</option>
          </select>
        </div>
        <div class="field">
          <label>Insumo <span class="req">*</span></label>
          <select v-model="form.itemId" class="select" :disabled="!form.branchId">
            <option value="">Seleccione...</option>
            <option v-for="s in stockItems" :key="s.item_id" :value="s.item_id">{{ s.item_name }} (disp: {{ s.quantity }})</option>
          </select>
        </div>
        <div class="field">
          <label>Cantidad utilizada <span class="req">*</span></label>
          <input v-model.number="form.quantity" class="input" type="number" min="0.001" step="0.001" :max="available || undefined" />
          <div v-if="available !== null" class="muted" style="font-size:12px;margin-top:4px">Disponible: {{ available }}</div>
        </div>
        <div class="field"><label>Lugar de uso</label><input v-model="form.usedWhere" class="input" /></div>
        <div class="field"><label>Motivo / finalidad</label><input v-model="form.usedFor" class="input" /></div>
        <div class="field"><label>Persona o area destinataria</label><input v-model="form.recipient" class="input" /></div>
      </div>
      <div class="field"><label>Observaciones</label><textarea v-model="form.observations" class="textarea"></textarea></div>

      <template v-if="customFields.length">
        <h3 class="mb-4 mt-2">Datos adicionales</h3>
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
            <input v-else v-model="customValues[f.id]" class="input" />
          </div>
        </div>
      </template>

      <div class="row mt-4">
        <button class="btn btn-primary" type="submit" :disabled="saving"><span v-if="saving" class="spinner"></span> Registrar uso</button>
        <RouterLink to="/usage" class="btn">Cancelar</RouterLink>
      </div>
    </form>
  </div>
</template>
