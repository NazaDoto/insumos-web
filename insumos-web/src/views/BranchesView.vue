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
        { key: 'address', label: 'Dirección' },
        { key: 'responsible_name', label: 'Responsable' },
        { key: 'status', label: 'Estado' },
        { key: 'actions', label: '', align: 'right' },
      ],
      showModal: false, saving: false, form: {}, errors: {}, togglingId: null,
      // Asignación de empleados
      manageBranch: null, employees: [], assignList: [], assignUserId: '',
      manageLoading: false, assigning: false, unassigningId: null,
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
      this.togglingId = b.id
      try { await api.delete(`/branches/${b.id}`); useUiStore().success('Sucursal desactivada'); await this.load() }
      catch (e) { useUiStore().error(e.userMessage) } finally { this.togglingId = null }
    },
    async openManage(b) {
      this.manageBranch = b; this.assignUserId = ''; this.manageLoading = true
      try {
        const [{ data: det }, { data: emps }] = await Promise.all([
          api.get(`/branches/${b.id}`),
          api.get('/users', { params: { role: 'employee', status: 'active', limit: 100 } }),
        ])
        this.assignList = det.data.employees || []
        this.employees = emps.data
      } catch (e) { useUiStore().error(e.userMessage) } finally { this.manageLoading = false }
    },
    async assign() {
      if (!this.assignUserId) return
      this.assigning = true
      try {
        await api.post(`/branches/${this.manageBranch.id}/employees`, { userId: Number(this.assignUserId) })
        useUiStore().success('Empleado asignado'); await this.openManage(this.manageBranch)
      } catch (e) { useUiStore().error(e.userMessage) } finally { this.assigning = false }
    },
    async unassign(uid) {
      this.unassigningId = uid
      try {
        await api.delete(`/branches/${this.manageBranch.id}/employees/${uid}`)
        useUiStore().success('Empleado desasignado'); await this.openManage(this.manageBranch)
      } catch (e) { useUiStore().error(e.userMessage) } finally { this.unassigningId = null }
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
          <button class="btn btn-sm" v-if="row.status === 'active'" :disabled="togglingId === row.id" @click="toggle(row)">
            <span v-if="togglingId === row.id" class="spinner dark"></span> Baja
          </button>
        </div>
      </template>
    </DataTable>

    <BaseModal v-if="showModal" :title="form.id ? 'Editar sucursal' : 'Nueva sucursal'" @close="showModal = false">
      <div class="field">
        <label>Nombre <span class="req">*</span></label>
        <input v-model="form.name" class="input" />
        <div v-if="errors.name" class="field-error">{{ errors.name }}</div>
      </div>
      <div class="field"><label>Dirección</label><input v-model="form.address" class="input" /></div>
      <div class="field"><label>Descripción</label><textarea v-model="form.description" class="textarea"></textarea></div>
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
        <button class="btn btn-primary" :disabled="assigning || !assignUserId" @click="assign">
          <span v-if="assigning" class="spinner"></span> Asignar
        </button>
      </div>
      <div v-if="manageLoading" class="loading-center"><span class="spinner dark"></span></div>
      <table v-else class="data data-cards">
        <thead><tr><th>Empleado</th><th>Email</th><th></th></tr></thead>
        <tbody>
          <tr v-for="e in assignList" :key="e.id">
            <td data-label="Empleado">{{ e.first_name }} {{ e.last_name }}</td>
            <td class="muted" data-label="Email">{{ e.email }}</td>
            <td class="text-right" data-label="">
              <button class="btn btn-sm btn-danger" :disabled="unassigningId === e.id" @click="unassign(e.id)">
                <span v-if="unassigningId === e.id" class="spinner"></span> Quitar
              </button>
            </td>
          </tr>
          <tr v-if="!assignList.length" class="empty-row"><td colspan="3" class="table-empty empty-cell">Sin empleados asignados</td></tr>
        </tbody>
      </table>
    </BaseModal>
  </div>
</template>
