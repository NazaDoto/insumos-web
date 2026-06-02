<script>
import { mapState } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import api from '@/services/api'
import ExportExcelButton from '@/components/ui/ExportExcelButton.vue'

export default {
  name: 'ReportsView',
  components: { ExportExcelButton },
  data() {
    return {
      type: 'stock', loading: false, rows: [], columns: [],
      filters: { from: '', to: '', branchId: '', categoryId: '', status: '' },
      branches: [], categories: [],
    }
  },
  computed: {
    ...mapState(useAuthStore, ['role']),
    reportTypes() {
      const all = [
        { v: 'stock', l: 'Stock actual', roles: ['sysadmin', 'admin'] },
        { v: 'low-stock', l: 'Bajo stock', roles: ['sysadmin', 'admin'] },
        { v: 'movements', l: 'Movimientos', roles: ['sysadmin', 'admin'] },
        { v: 'usage', l: 'Uso de insumos', roles: ['sysadmin', 'admin'] },
        { v: 'orders', l: 'Pedidos', roles: ['sysadmin', 'admin', 'provider'] },
      ]
      return all.filter(t => t.roles.includes(this.role))
    },
    reportExportParams() {
      return { type: this.type, ...this.filters }
    },
    reportFilename() {
      return `reporte_${this.type}`
    },
  },
  mounted() {
    this.type = this.reportTypes[0]?.v || 'orders'
    this.loadBranches(); this.loadCategories(); this.run()
  },
  methods: {
    async loadBranches() { try { const { data } = await api.get('/branches'); this.branches = data.data } catch (e) { /* */ } },
    async loadCategories() { try { const { data } = await api.get('/categories'); this.categories = data.data } catch (e) { /* */ } },
    async run() {
      this.loading = true
      try {
        const { data } = await api.get(`/reports/${this.type}`, { params: this.filters })
        this.rows = data.data
        this.columns = this.rows.length ? Object.keys(this.rows[0]) : []
      } catch (e) { useUiStore().error(e.userMessage) } finally { this.loading = false }
    },
    fmtVal(v) {
      if (v === null || v === undefined) return '-'
      if (typeof v === 'string' && /\d{4}-\d{2}-\d{2}T/.test(v)) return new Date(v).toLocaleString('es-AR')
      return v
    },
  },
}
</script>

<template>
  <div>
    <div class="page-header">
      <div><h1>Reportes</h1><p>Control y análisis de información</p></div>
      <ExportExcelButton
        path="/reports/export/excel"
        :params="reportExportParams"
        :filename="reportFilename"
        :disabled="!rows.length"
      />
    </div>

    <div class="toolbar">
      <select v-model="type" class="select" style="max-width:200px" @change="run">
        <option v-for="t in reportTypes" :key="t.v" :value="t.v">{{ t.l }}</option>
      </select>
      <input v-model="filters.from" class="input" type="date" />
      <input v-model="filters.to" class="input" type="date" />
      <select v-if="['stock'].includes(type)" v-model="filters.branchId" class="select" style="max-width:180px">
        <option value="">Todas las sucursales</option>
        <option v-for="b in branches" :key="b.id" :value="b.id">{{ b.name }}</option>
      </select>
      <button class="btn btn-primary" :disabled="loading" @click="run">
        <span v-if="loading" class="spinner"></span> Generar
      </button>
    </div>

    <div class="card">
      <div v-if="loading" class="loading-center"><span class="spinner dark"></span></div>
      <div v-else class="table-wrap">
        <table class="data data-cards">
          <thead><tr><th v-for="c in columns" :key="c">{{ c.replace(/_/g, ' ').toUpperCase() }}</th></tr></thead>
          <tbody>
            <tr v-for="(r, i) in rows" :key="i">
              <td v-for="c in columns" :key="c" :data-label="c.replace(/_/g, ' ')">{{ fmtVal(r[c]) }}</td>
            </tr>
            <tr v-if="!rows.length" class="empty-row"><td :colspan="columns.length || 1" class="table-empty empty-cell">Sin datos para los filtros seleccionados</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
