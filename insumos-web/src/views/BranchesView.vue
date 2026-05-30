<script>
import { mapState } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import api from '@/services/api'
import DataTable from '@/components/ui/DataTable.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'

export default {
  name: 'BranchesView',
  components: { DataTable, BaseModal, StatusBadge },
  data() {
    return {
      rows: [], loading: true,
      columns: [
        { key: 'name', label: 'Nombre' },
        { key: 'address', label: 'Direccion' },
        { key: 'responsible_name', label: 'Responsable' },
        { key: 'status', label: 'Estado' },
        { key: 'actions', label: '', align: 'right' },
      ],
      showModal: false, saving: false, form: {}, errors: {},
      // Asignacion de empleados
      manageBranch: null, employees: [], assignList: [], assignUserId: '',
    }
  },
  computed: {
    ...mapState(useAuthStore, ['role']),
    canEdit() { return this.role === 'admin' || this.role === 'sysadmin' },
  },
  mounted() { this.load() },
  methods: {
    async load() {
      this.loading = true
      try { const { data } = await api.get('/branches'); this.rows = data.data } catch (e) { useUiStore().error(e.userMessage) } finally { this.loading = false }
    },
    openCreate() { this.form = { name: '', description: '', address: '' }; this.errors = {}; this.showModal = true },
    openEdit(b) { this.form = { id: b.id, name: b.name, description: b.description, address: b.address, status: b.status }; this.errors = {}; this.showModal = true },
    async save() {
      this.saving = true; this.errors = {}
      try {
        if (this.form.id) { await api.put(`/branches/${this.form.id}`, this.form); useUiStore().success('Sucursal actualizada') }
        else { await api.post('/branches', this.form); useUiStore().success('Sucursal creada') }
        this.showModal = false; this.load()
      } catch (e) { this.errors = e.details || {}; useUiStore().error(e.userMessage) } finally { this.saving = false }
    },
    async toggle(b) {
      try { await api.delete(`/branches/${b.id}`); useUiStore().success('Sucursal desactivada'); this.load() }
      catch (e) { useUiStore().error(e.userMessage) }
    },
    async openManage(b) {
      this.manageBranch = b; this.assignUserId = ''
      try {
        const [{ data: det }, { data: emps }] = await Promise.all([
          api.get(`/branches/${b.id}`),
          api.get('/users', { params: { role: 'employee', status: 'active', limit: 100 } }),
        ])
        this.assignList = det.data.employees || []
        this.employees = emps.data
      } catch (e) { useUiStore().error(e.userMessage) }
    },
    async assign() {
      if (!this.assignUserId) return
      try {
        await api.post(`/branches/${this.manageBranch.id}/employees`, { userId: Number(this.assignUserId) })
        useUiStore().success('Empleado asignado'); this.openManage(this.manageBranch)
      } catch (e) { useUiStore().error(e.userMessage) }
    },
    async unassign(uid) {
      try {
        await api.delete(`/branches/${this.manageBranch.id}/employees/${uid}`)
        useUiStore().success('Empleado desasignado'); this.openManage(this.manageBranch)
      } catch (e) { useUiStore().error(e.userMessage) }
    },
  },
}
</script>

<template>
  <div>
    <div class="page-header">
      <div><h1>Oficinas / Sucursales</h1><p>Distribuye tus insumos entre ubicaciones</p></div>
      <button v-if="canEdit" class="btn btn-primary" @click="openCreate">+ Nueva sucursal</button>
    </div>

    <DataTable :columns="columns" :rows="rows" :loading="loading">
      <template #cell-responsible_name="{ row }">{{ row.responsible_name || '-' }}</template>
      <template #cell-status="{ row }"><StatusBadge :status="row.status" /></template>
      <template #cell-actions="{ row }">
        <div class="actions" style="justify-content:flex-end" v-if="canEdit">
          <RouterLink :to="`/stock?branchId=${row.id}`" class="btn btn-sm">Stock</RouterLink>
          <button class="btn btn-sm" @click="openManage(row)">Empleados</button>
          <button class="btn btn-sm" @click="openEdit(row)">Editar</button>
          <button class="btn btn-sm" v-if="row.status === 'active'" @click="toggle(row)">Baja</button>
        </div>
      </template>
    </DataTable>

    <BaseModal v-if="showModal" :title="form.id ? 'Editar sucursal' : 'Nueva sucursal'" @close="showModal = false">
      <div class="field">
        <label>Nombre <span class="req">*</span></label>
        <input v-model="form.name" class="input" />
        <div v-if="errors.name" class="field-error">{{ errors.name }}</div>
      </div>
      <div class="field"><label>Direccion</label><input v-model="form.address" class="input" /></div>
      <div class="field"><label>Descripcion</label><textarea v-model="form.description" class="textarea"></textarea></div>
      <template #footer>
        <button class="btn" @click="showModal = false">Cancelar</button>
        <button class="btn btn-primary" :disabled="saving" @click="save"><span v-if="saving" class="spinner"></span> Guardar</button>
      </template>
    </BaseModal>

    <BaseModal v-if="manageBranch" :title="`Empleados de ${manageBranch.name}`" @close="manageBranch = null">
      <div class="row mb-4">
        <select v-model="assignUserId" class="select" style="flex:1">
          <option value="">Seleccione empleado...</option>
          <option v-for="e in employees" :key="e.id" :value="e.id">{{ e.firstName }} {{ e.lastName }}</option>
        </select>
        <button class="btn btn-primary" @click="assign">Asignar</button>
      </div>
      <table class="data">
        <thead><tr><th>Empleado</th><th>Email</th><th></th></tr></thead>
        <tbody>
          <tr v-for="e in assignList" :key="e.id">
            <td>{{ e.first_name }} {{ e.last_name }}</td>
            <td class="muted">{{ e.email }}</td>
            <td class="text-right"><button class="btn btn-sm btn-danger" @click="unassign(e.id)">Quitar</button></td>
          </tr>
          <tr v-if="!assignList.length"><td colspan="3" class="table-empty">Sin empleados asignados</td></tr>
        </tbody>
      </table>
    </BaseModal>
  </div>
</template>
