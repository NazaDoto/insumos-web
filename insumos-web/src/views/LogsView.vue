<script>
import { useUiStore } from '@/stores/ui'
import api from '@/services/api'
import DataTable from '@/components/ui/DataTable.vue'
import Pagination from '@/components/ui/Pagination.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import ExportExcelButton from '@/components/ui/ExportExcelButton.vue'

export default {
  name: 'LogsView',
  components: { DataTable, Pagination, BaseModal, ExportExcelButton },
  data() {
    return {
      rows: [], meta: {}, loading: true, page: 1,
      filters: { module: '', action: '', from: '', to: '' },
      columns: [
        { key: 'created_at', label: 'Fecha' },
        { key: 'user_name', label: 'Usuario' },
        { key: 'user_role', label: 'Rol' },
        { key: 'action', label: 'Acción' },
        { key: 'module', label: 'Módulo' },
        { key: 'detail', label: '', align: 'right' },
      ],
      detail: null,
    }
  },
  mounted() { this.load() },
  methods: {
    async load() {
      this.loading = true
      try { const { data } = await api.get('/logs', { params: { ...this.filters, page: this.page, limit: 25 } }); this.rows = data.data; this.meta = data.meta }
      catch (e) { useUiStore().error(e.userMessage) } finally { this.loading = false }
    },
    onFilter() { this.page = 1; this.load() },
    changePage(p) { this.page = p; this.load() },
    date(d) { return d ? new Date(d).toLocaleString('es-AR') : '' },
    fmtJson(v) { if (!v) return '-'; try { return JSON.stringify(typeof v === 'string' ? JSON.parse(v) : v, null, 2) } catch (e) { return v } },
  },
}
</script>

<template>
  <div>
    <div class="page-header"><div><h1>Logs y auditoría</h1><p>Registro de acciones del sistema</p></div></div>

    <div class="toolbar">
      <input v-model="filters.module" class="input" placeholder="Módulo" style="max-width:150px" @keyup.enter="onFilter" />
      <input v-model="filters.action" class="input" placeholder="Acción" style="max-width:150px" @keyup.enter="onFilter" />
      <input v-model="filters.from" class="input" type="date" @change="onFilter" />
      <input v-model="filters.to" class="input" type="date" @change="onFilter" />
      <button class="btn" @click="onFilter">Filtrar</button>
      <div class="spacer"></div>
      <ExportExcelButton path="/export/logs" :params="filters" filename="logs" />
    </div>

    <DataTable :columns="columns" :rows="rows" :loading="loading">
      <template #cell-created_at="{ row }"><span class="muted">{{ date(row.created_at) }}</span></template>
      <template #cell-user_name="{ row }">{{ row.user_name || '-' }}</template>
      <template #cell-user_role="{ row }"><span class="badge gray">{{ row.user_role || '-' }}</span></template>
      <template #cell-detail="{ row }"><button class="btn btn-sm" @click="detail = row">Ver</button></template>
      <template #footer><Pagination :meta="meta" @change="changePage" /></template>
    </DataTable>

    <BaseModal v-if="detail" title="Detalle del log" @close="detail = null">
      <div class="row" style="justify-content:space-between;padding:6px 0"><span class="muted">Usuario</span><span>{{ detail.user_name }} ({{ detail.user_role }})</span></div>
      <div class="row" style="justify-content:space-between;padding:6px 0"><span class="muted">Acción</span><span>{{ detail.action }}</span></div>
      <div class="row" style="justify-content:space-between;padding:6px 0"><span class="muted">Módulo</span><span>{{ detail.module }}</span></div>
      <div class="row" style="justify-content:space-between;padding:6px 0"><span class="muted">Registro afectado</span><span>{{ detail.record_id || '-' }}</span></div>
      <div class="row" style="justify-content:space-between;padding:6px 0"><span class="muted">IP</span><span>{{ detail.ip_address || '-' }}</span></div>
      <div class="field mt-4"><label>Valor anterior</label><pre class="input" style="white-space:pre-wrap">{{ fmtJson(detail.old_value) }}</pre></div>
      <div class="field"><label>Valor nuevo</label><pre class="input" style="white-space:pre-wrap">{{ fmtJson(detail.new_value) }}</pre></div>
    </BaseModal>
  </div>
</template>
