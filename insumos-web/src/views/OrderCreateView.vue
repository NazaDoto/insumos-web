<script>
import { useUiStore } from '@/stores/ui'
import api from '@/services/api'

export default {
  name: 'OrderCreateView',
  data() {
    return {
      providers: [], providerItems: [], branches: [],
      providerId: '', observations: '',
      lines: [],
      saving: false, loadingItems: false,
    }
  },
  mounted() {
    this.loadProviders(); this.loadBranches()
    if (this.$route.query.providerId) {
      this.providerId = this.$route.query.providerId
      this.onProviderChange()
    }
  },
  methods: {
    async loadProviders() { try { const { data } = await api.get('/providers'); this.providers = data.data } catch (e) { useUiStore().error(e.userMessage) } },
    async loadBranches() { try { const { data } = await api.get('/branches'); this.branches = data.data } catch (e) { /* */ } },
    async onProviderChange() {
      this.lines = []; this.providerItems = []
      if (!this.providerId) return
      this.loadingItems = true
      try { const { data } = await api.get(`/providers/${this.providerId}/items`); this.providerItems = data.data }
      catch (e) { useUiStore().error(e.userMessage) } finally { this.loadingItems = false }
    },
    addLine() { this.lines.push({ itemId: '', requestedQuantity: 1, destinationBranchId: '', observations: '' }) },
    removeLine(i) { this.lines.splice(i, 1) },
    itemName(id) { const it = this.providerItems.find(p => p.id === Number(id)); return it ? it.name : '' },
    async submit() {
      if (!this.providerId) return useUiStore().warning('Seleccione un proveedor')
      const items = this.lines.filter(l => l.itemId && l.requestedQuantity > 0).map(l => ({
        itemId: Number(l.itemId), requestedQuantity: Number(l.requestedQuantity),
        destinationBranchId: l.destinationBranchId ? Number(l.destinationBranchId) : null,
        observations: l.observations || null,
      }))
      if (!items.length) return useUiStore().warning('Agregue al menos un insumo')
      this.saving = true
      try {
        const { data } = await api.post('/orders', { providerId: Number(this.providerId), observations: this.observations, items })
        useUiStore().success('Pedido creado')
        this.$router.push(`/orders/${data.data.id}`)
      } catch (e) { useUiStore().error(e.userMessage) } finally { this.saving = false }
    },
  },
}
</script>

<template>
  <div>
    <div class="page-header">
      <div><h1>Nuevo pedido</h1><p>Solicita insumos a un proveedor</p></div>
      <RouterLink to="/orders" class="btn">Volver</RouterLink>
    </div>

    <div class="card card-pad" style="max-width:900px">
      <div class="form-grid">
        <div class="field">
          <label>Proveedor <span class="req">*</span></label>
          <select v-model="providerId" class="select" @change="onProviderChange">
            <option value="">Seleccione...</option>
            <option v-for="p in providers" :key="p.id" :value="p.id">{{ p.first_name }} {{ p.last_name }}</option>
          </select>
        </div>
        <div class="field">
          <label>Observaciones</label>
          <input v-model="observations" class="input" placeholder="Observaciones generales del pedido" />
        </div>
      </div>

      <div class="card-header" style="padding-left:0;padding-right:0">
        <h3>Insumos solicitados <span v-if="loadingItems" class="muted" style="font-weight:400;font-size:13px">(cargando catalogo...)</span></h3>
        <button class="btn btn-sm" :disabled="!providerId || loadingItems" @click="addLine">+ Agregar insumo</button>
      </div>

      <table class="data">
        <thead><tr><th style="width:32%">Insumo</th><th style="width:14%">Cantidad</th><th style="width:26%">Sucursal destino</th><th>Observacion</th><th></th></tr></thead>
        <tbody>
          <tr v-for="(l, i) in lines" :key="i">
            <td>
              <select v-model="l.itemId" class="select">
                <option value="">Seleccione...</option>
                <option v-for="it in providerItems" :key="it.id" :value="it.id">{{ it.name }} (disp: {{ it.available }})</option>
              </select>
            </td>
            <td><input v-model.number="l.requestedQuantity" class="input" type="number" min="0.001" step="0.001" /></td>
            <td>
              <select v-model="l.destinationBranchId" class="select">
                <option value="">Sin asignar</option>
                <option v-for="b in branches" :key="b.id" :value="b.id">{{ b.name }}</option>
              </select>
            </td>
            <td><input v-model="l.observations" class="input" /></td>
            <td><button class="btn btn-sm btn-danger" @click="removeLine(i)">&times;</button></td>
          </tr>
          <tr v-if="!lines.length"><td colspan="5" class="table-empty">Agregue insumos al pedido</td></tr>
        </tbody>
      </table>

      <div class="row mt-4">
        <button class="btn btn-primary" :disabled="saving" @click="submit"><span v-if="saving" class="spinner"></span> Enviar pedido</button>
        <RouterLink to="/orders" class="btn">Cancelar</RouterLink>
      </div>
    </div>
  </div>
</template>
