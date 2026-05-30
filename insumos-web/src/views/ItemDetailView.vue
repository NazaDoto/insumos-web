<script>
import { useUiStore } from '@/stores/ui'
import api from '@/services/api'
import StatusBadge from '@/components/ui/StatusBadge.vue'

export default {
  name: 'ItemDetailView',
  components: { StatusBadge },
  data() {
    return { loading: true, item: null, movements: [], tab: 'info' }
  },
  computed: { id() { return this.$route.params.id } },
  mounted() { this.load() },
  methods: {
    async load() {
      this.loading = true
      try {
        const [{ data: d1 }, { data: d2 }] = await Promise.all([
          api.get(`/items/${this.id}`),
          api.get(`/items/${this.id}/movements`),
        ])
        this.item = d1.data
        this.movements = d2.data
      } catch (e) { useUiStore().error(e.userMessage) } finally { this.loading = false }
    },
    date(d) { return d ? new Date(d).toLocaleString('es-AR') : '' },
  },
}
</script>

<template>
  <div>
    <div v-if="loading" class="loading-center"><span class="spinner dark"></span></div>
    <template v-else-if="item">
      <div class="page-header">
        <div><h1>{{ item.name }}</h1><p>{{ item.category || 'Sin categoria' }} &middot; {{ item.unit }}</p></div>
        <div class="row">
          <RouterLink :to="`/items/${id}/edit`" class="btn btn-primary">Editar</RouterLink>
          <RouterLink to="/items" class="btn">Volver</RouterLink>
        </div>
      </div>

      <div class="stat-grid mb-4">
        <div class="stat"><span class="stat-label">Stock total</span><span class="stat-value">{{ item.totalStock }}</span></div>
        <div class="stat"><span class="stat-label">Stock minimo</span><span class="stat-value">{{ item.minimumStock }}</span></div>
        <div class="stat"><span class="stat-label">Estado</span><span class="mt-2"><StatusBadge :status="item.status" /></span></div>
        <div class="stat"><span class="stat-label">Estado fisico</span><span class="mt-2"><StatusBadge :status="item.conditionState" /></span></div>
      </div>

      <div class="grid-2">
        <div class="card">
          <div class="card-header"><h3>Stock por sucursal</h3></div>
          <div class="table-wrap">
            <table class="data">
              <thead><tr><th>Sucursal</th><th class="text-right">Cantidad</th></tr></thead>
              <tbody>
                <tr v-for="(s, i) in item.stockByBranch" :key="i">
                  <td>{{ s.branch_name || 'Sin asignar' }}</td>
                  <td class="text-right">{{ s.quantity }}</td>
                </tr>
                <tr v-if="!item.stockByBranch.length"><td colspan="2" class="table-empty">Sin stock distribuido</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="card">
          <div class="card-header"><h3>Atributos personalizados</h3></div>
          <div class="card-pad">
            <div v-for="cv in item.customValues" :key="cv.field_id" class="row" style="justify-content:space-between;border-bottom:1px solid var(--c-border);padding:8px 0">
              <span class="muted">{{ cv.field_label }}</span>
              <span style="font-weight:550">{{ cv.value || '-' }}</span>
            </div>
            <p v-if="!item.customValues.length" class="muted">No hay atributos definidos</p>
          </div>
        </div>
      </div>

      <div class="card mt-4">
        <div class="card-header"><h3>Historial de movimientos</h3></div>
        <div class="table-wrap">
          <table class="data">
            <thead><tr><th>Tipo</th><th>Cant.</th><th>Origen</th><th>Destino</th><th>Motivo</th><th>Usuario</th><th>Fecha</th></tr></thead>
            <tbody>
              <tr v-for="m in movements" :key="m.id">
                <td><StatusBadge :status="m.movement_type" /></td>
                <td>{{ m.quantity }}</td>
                <td>{{ m.origin_branch || '-' }}</td>
                <td>{{ m.destination_branch || '-' }}</td>
                <td class="muted">{{ m.reason || '-' }}</td>
                <td>{{ m.user_name || '-' }}</td>
                <td class="muted">{{ date(m.created_at) }}</td>
              </tr>
              <tr v-if="!movements.length"><td colspan="7" class="table-empty">Sin movimientos</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>
  </div>
</template>
