<script>
import { mapState } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import api from '@/services/api'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'

const PROVIDER_TRANSITIONS = {
  pending: ['accepted', 'rejected'],
  accepted: ['preparing', 'sent', 'delivered', 'partial'],
  preparing: ['sent', 'delivered', 'partial'],
  sent: ['delivered', 'partial'],
}
const LABELS = { accepted: 'Aceptar', rejected: 'Rechazar', preparing: 'En preparacion', sent: 'Marcar enviado', delivered: 'Marcar entregado', partial: 'Entrega parcial' }

export default {
  name: 'OrderDetailView',
  components: { StatusBadge, BaseModal, ConfirmDialog },
  data() {
    return {
      loading: true, order: null,
      statusModal: false, newStatus: '', statusObs: '', editLines: [], saving: false,
      confirmCancel: false, cancelling: false,
    }
  },
  computed: {
    ...mapState(useAuthStore, ['role']),
    id() { return this.$route.params.id },
    transitions() {
      if (this.role !== 'provider' || !this.order) return []
      return (PROVIDER_TRANSITIONS[this.order.status] || []).map(s => ({ value: s, label: LABELS[s] || s }))
    },
    canCancel() { return this.role === 'admin' && this.order && this.order.status === 'pending' },
    deliversStock() { return this.newStatus === 'delivered' || this.newStatus === 'partial' },
  },
  mounted() { this.load() },
  methods: {
    async load() {
      this.loading = true
      try { const { data } = await api.get(`/orders/${this.id}`); this.order = data.data }
      catch (e) { useUiStore().error(e.userMessage) } finally { this.loading = false }
    },
    date(d) { return d ? new Date(d).toLocaleString('es-AR') : '' },
    openStatus(status) {
      this.newStatus = status; this.statusObs = ''
      this.editLines = this.order.details.map(d => ({
        id: d.id, name: d.item_name, requested: d.requested_quantity,
        approvedQuantity: d.approved_quantity ?? d.requested_quantity,
        deliveredQuantity: d.delivered_quantity ?? d.approved_quantity ?? d.requested_quantity,
      }))
      this.statusModal = true
    },
    async submitStatus() {
      this.saving = true
      try {
        const payload = { status: this.newStatus, observations: this.statusObs }
        if (this.deliversStock) {
          payload.items = this.editLines.map(l => ({ id: l.id, approvedQuantity: Number(l.approvedQuantity), deliveredQuantity: Number(l.deliveredQuantity) }))
        }
        await api.patch(`/orders/${this.id}/status`, payload)
        useUiStore().success('Estado actualizado')
        this.statusModal = false; this.load()
      } catch (e) { useUiStore().error(e.userMessage) } finally { this.saving = false }
    },
    async doCancel() {
      this.cancelling = true
      try { await api.patch(`/orders/${this.id}/cancel`, {}); useUiStore().success('Pedido cancelado'); this.confirmCancel = false; this.load() }
      catch (e) { useUiStore().error(e.userMessage) } finally { this.cancelling = false }
    },
  },
}
</script>

<template>
  <div>
    <div v-if="loading" class="loading-center"><span class="spinner dark"></span></div>
    <template v-else-if="order">
      <div class="page-header">
        <div><h1>Pedido #{{ order.id }} <StatusBadge :status="order.status" /></h1>
          <p>{{ order.adminName }} &rarr; {{ order.providerName }}</p></div>
        <div class="row">
          <button v-for="t in transitions" :key="t.value" class="btn btn-primary btn-sm" @click="openStatus(t.value)">{{ t.label }}</button>
          <button v-if="canCancel" class="btn btn-danger btn-sm" @click="confirmCancel = true">Cancelar pedido</button>
          <RouterLink to="/orders" class="btn">Volver</RouterLink>
        </div>
      </div>

      <div class="grid-2 mb-4">
        <div class="card card-pad">
          <h3 class="mb-4">Informacion</h3>
          <div class="row" style="justify-content:space-between;padding:6px 0"><span class="muted">Fecha</span><span>{{ date(order.created_at) }}</span></div>
          <div class="row" style="justify-content:space-between;padding:6px 0"><span class="muted">Obs. administrador</span><span>{{ order.admin_observations || '-' }}</span></div>
          <div class="row" style="justify-content:space-between;padding:6px 0"><span class="muted">Obs. proveedor</span><span>{{ order.provider_observations || '-' }}</span></div>
        </div>
        <div class="card card-pad">
          <h3 class="mb-4">Historial de estados</h3>
          <div v-for="h in order.history" :key="h.id" class="row" style="gap:10px;padding:6px 0;border-bottom:1px solid var(--c-border)">
            <StatusBadge :status="h.status" />
            <span class="muted" style="flex:1">{{ h.observations || '' }}</span>
            <span class="muted" style="font-size:12px">{{ date(h.created_at) }}</span>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header"><h3>Insumos solicitados</h3></div>
        <div class="table-wrap">
          <table class="data">
            <thead><tr><th>Insumo</th><th class="text-right">Solicitado</th><th class="text-right">Aprobado</th><th class="text-right">Entregado</th><th>Destino</th><th>Obs.</th></tr></thead>
            <tbody>
              <tr v-for="d in order.details" :key="d.id">
                <td style="font-weight:550">{{ d.item_name }}</td>
                <td class="text-right">{{ d.requested_quantity }} {{ d.unit }}</td>
                <td class="text-right">{{ d.approved_quantity ?? '-' }}</td>
                <td class="text-right">{{ d.delivered_quantity ?? '-' }}</td>
                <td>{{ d.destination_branch || '-' }}</td>
                <td class="muted">{{ d.observations || '-' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <BaseModal v-if="statusModal" large :title="`Actualizar a: ${newStatus}`" @close="statusModal = false">
        <div v-if="deliversStock" class="mb-4">
          <p class="muted mb-4">Confirme las cantidades entregadas. El stock del administrador se actualizara automaticamente.</p>
          <table class="data">
            <thead><tr><th>Insumo</th><th>Solicitado</th><th>Aprobado</th><th>Entregado</th></tr></thead>
            <tbody>
              <tr v-for="l in editLines" :key="l.id">
                <td>{{ l.name }}</td>
                <td>{{ l.requested }}</td>
                <td><input v-model.number="l.approvedQuantity" class="input" type="number" min="0" step="0.001" style="width:100px" /></td>
                <td><input v-model.number="l.deliveredQuantity" class="input" type="number" min="0" step="0.001" style="width:100px" /></td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="field">
          <label>Observaciones</label>
          <textarea v-model="statusObs" class="textarea"></textarea>
        </div>
        <template #footer>
          <button class="btn" @click="statusModal = false">Cancelar</button>
          <button class="btn btn-primary" :disabled="saving" @click="submitStatus"><span v-if="saving" class="spinner"></span> Confirmar</button>
        </template>
      </BaseModal>

      <ConfirmDialog v-if="confirmCancel" danger title="Cancelar pedido"
        message="Esta seguro de cancelar este pedido?" confirm-text="Si, cancelar" :loading="cancelling"
        @confirm="doCancel" @cancel="confirmCancel = false" />
    </template>
  </div>
</template>
