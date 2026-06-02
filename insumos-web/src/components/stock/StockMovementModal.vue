<script>
import { useUiStore } from '@/stores/ui'
import api from '@/services/api'
import BaseModal from '@/components/ui/BaseModal.vue'

const TYPE_LABELS = {
  income: 'Ingreso a sucursal',
  outcome: 'Egreso a sin asignar',
  transfer: 'Transferencia entre sucursales',
  adjustment: 'Ajuste manual',
}

export default {
  name: 'StockMovementModal',
  components: { BaseModal },
  props: {
    show: { type: Boolean, default: false },
    initial: { type: Object, default: () => ({}) },
    branches: { type: Array, default: () => [] },
    items: { type: Array, default: () => [] },
  },
  emits: ['close', 'done'],
  data() {
    return {
      saving: false,
      levels: { unassigned: 0, branches: [] },
      levelsLoading: false,
      form: this.emptyForm(),
    }
  },
  computed: {
    typeLabel() {
      return TYPE_LABELS[this.form.type] || 'Movimiento'
    },
    branchQtyMap() {
      const m = {}
      for (const b of this.levels.branches) m[b.id] = Number(b.quantity)
      return m
    },
    originBranchQty() {
      return this.form.originBranchId ? (this.branchQtyMap[this.form.originBranchId] ?? 0) : 0
    },
    destBranchQty() {
      return this.form.destinationBranchId ? (this.branchQtyMap[this.form.destinationBranchId] ?? 0) : 0
    },
    selectedBranchQty() {
      return this.form.branchId ? (this.branchQtyMap[this.form.branchId] ?? 0) : 0
    },
    maxQuantity() {
      if (this.form.type === 'income') return this.levels.unassigned
      if (this.form.type === 'outcome') return this.selectedBranchQty
      if (this.form.type === 'transfer') return this.originBranchQty
      return null
    },
    showStockHints() {
      return this.form.type !== 'adjustment' && !!this.form.itemId
    },
  },
  watch: {
    show(v) {
      if (v) {
        this.form = { ...this.emptyForm(), ...this.initial }
        this.loadLevels()
      }
    },
    'form.itemId'() { this.loadLevels() },
    'form.type'() {
      if (this.form.type === 'income' || this.form.type === 'outcome') this.form.quantity = null
    },
  },
  methods: {
    emptyForm() {
      return {
        type: 'income',
        itemId: '',
        branchId: '',
        originBranchId: '',
        destinationBranchId: '',
        quantity: null,
        newQuantity: null,
        reason: '',
      }
    },
    async loadLevels() {
      if (!this.form.itemId) {
        this.levels = { unassigned: 0, branches: [] }
        return
      }
      this.levelsLoading = true
      try {
        const { data } = await api.get('/stock/levels', { params: { itemId: this.form.itemId } })
        this.levels = data.data
      } catch (e) {
        this.levels = { unassigned: 0, branches: [] }
      } finally {
        this.levelsLoading = false
      }
    },
    branchOptionLabel(b) {
      const qty = this.branchQtyMap[b.id]
      return `${b.name} (${qty ?? 0})`
    },
    async submit() {
      this.saving = true
      const f = this.form
      try {
        if (f.type === 'income') {
          await api.post('/stock/income', {
            itemId: +f.itemId,
            branchId: +f.branchId,
            quantity: +f.quantity,
            reason: f.reason,
          })
        } else if (f.type === 'outcome') {
          await api.post('/stock/outcome', {
            itemId: +f.itemId,
            branchId: +f.branchId,
            quantity: +f.quantity,
            reason: f.reason,
          })
        } else if (f.type === 'transfer') {
          await api.post('/stock/transfer', {
            itemId: +f.itemId,
            originBranchId: +f.originBranchId,
            destinationBranchId: +f.destinationBranchId,
            quantity: +f.quantity,
            reason: f.reason,
          })
        } else if (f.type === 'adjustment') {
          await api.post('/stock/adjustment', {
            itemId: +f.itemId,
            branchId: +f.branchId,
            newQuantity: +f.newQuantity,
            reason: f.reason,
          })
        }
        useUiStore().success('Movimiento registrado')
        this.$emit('done')
        this.$emit('close')
      } catch (e) {
        useUiStore().error(e.userMessage)
      } finally {
        this.saving = false
      }
    },
  },
}
</script>

<template>
  <BaseModal v-if="show" :title="typeLabel" @close="$emit('close')">
    <div class="field">
      <label>Tipo de movimiento</label>
      <select v-model="form.type" class="select">
        <option value="income">Ingreso a sucursal (desde sin asignar)</option>
        <option value="outcome">Egreso (sucursal → sin asignar)</option>
        <option value="transfer">Transferencia entre sucursales</option>
        <option value="adjustment">Ajuste manual en sucursal</option>
      </select>
    </div>
    <div class="field">
      <label>Insumo <span class="req">*</span></label>
      <select v-model="form.itemId" class="select">
        <option value="">Seleccione...</option>
        <option v-for="i in items" :key="i.id" :value="i.id">{{ i.name }}</option>
      </select>
    </div>

    <p v-if="showStockHints && levelsLoading" class="muted" style="margin-bottom:12px">Cargando stock...</p>
    <p v-else-if="showStockHints && form.type === 'income'" class="muted" style="margin-bottom:12px">
      Stock sin asignar disponible: <strong>{{ levels.unassigned }}</strong>
    </p>
    <p v-else-if="showStockHints && form.type === 'outcome' && form.branchId" class="muted" style="margin-bottom:12px">
      En sucursal: <strong>{{ selectedBranchQty }}</strong>
    </p>
    <template v-else-if="showStockHints && form.type === 'transfer'">
      <p v-if="form.originBranchId" class="muted" style="margin-bottom:4px">
        Origen: <strong>{{ originBranchQty }}</strong>
      </p>
      <p v-if="form.destinationBranchId" class="muted" style="margin-bottom:12px">
        Destino: <strong>{{ destBranchQty }}</strong>
      </p>
    </template>

    <template v-if="form.type === 'transfer'">
      <div class="field">
        <label>Sucursal origen <span class="req">*</span></label>
        <select v-model="form.originBranchId" class="select">
          <option value="">Seleccione...</option>
          <option v-for="b in branches" :key="b.id" :value="b.id">{{ branchOptionLabel(b) }}</option>
        </select>
      </div>
      <div class="field">
        <label>Sucursal destino <span class="req">*</span></label>
        <select v-model="form.destinationBranchId" class="select">
          <option value="">Seleccione...</option>
          <option v-for="b in branches" :key="b.id" :value="b.id">{{ branchOptionLabel(b) }}</option>
        </select>
      </div>
    </template>
    <div v-else class="field">
      <label>Sucursal <span class="req">*</span></label>
      <select v-model="form.branchId" class="select">
        <option value="">Seleccione...</option>
        <option v-for="b in branches" :key="b.id" :value="b.id">{{ branchOptionLabel(b) }}</option>
      </select>
    </div>

    <div v-if="form.type === 'adjustment'" class="field">
      <label>Nueva cantidad en sucursal <span class="req">*</span></label>
      <input v-model.number="form.newQuantity" class="input" type="number" min="0" step="0.001" />
      <p class="muted" style="margin-top:6px;font-size:0.85rem">El ajuste fija la cantidad en la sucursal sin usar el stock sin asignar.</p>
    </div>
    <div v-else class="field">
      <label>Cantidad <span class="req">*</span></label>
      <input
        v-model.number="form.quantity"
        class="input"
        type="number"
        min="0.001"
        :max="maxQuantity != null && maxQuantity > 0 ? maxQuantity : undefined"
        step="0.001"
      />
      <p v-if="maxQuantity != null && form.type !== 'adjustment'" class="muted" style="margin-top:6px;font-size:0.85rem">
        Máximo: {{ maxQuantity }}
      </p>
    </div>

    <div class="field">
      <label>Motivo / Observación</label>
      <input v-model="form.reason" class="input" />
    </div>

    <template #footer>
      <button type="button" class="btn" @click="$emit('close')">Cancelar</button>
      <button type="button" class="btn btn-primary" :disabled="saving" @click="submit">
        <span v-if="saving" class="spinner"></span> Registrar
      </button>
    </template>
  </BaseModal>
</template>
