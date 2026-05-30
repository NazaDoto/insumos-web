<script>
import { mapState } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import api from '@/services/api'
import DataTable from '@/components/ui/DataTable.vue'
import Pagination from '@/components/ui/Pagination.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'

const ROLE_LABEL = { sysadmin: 'Admin Sistema', admin: 'Administrador', provider: 'Proveedor', employee: 'Empleado' }

export default {
  name: 'UsersView',
  components: { DataTable, Pagination, BaseModal, StatusBadge },
  data() {
    return {
      rows: [], meta: {}, loading: true,
      filters: { search: '', role: '', status: '' },
      page: 1,
      columns: [
        { key: 'name', label: 'Nombre' },
        { key: 'email', label: 'Email' },
        { key: 'username', label: 'Usuario' },
        { key: 'role', label: 'Rol' },
        { key: 'status', label: 'Estado' },
        { key: 'actions', label: '', align: 'right' },
      ],
      showModal: false, saving: false, form: {}, errors: {},
      admins: [], togglingId: null,
    }
  },
  computed: {
    ...mapState(useAuthStore, ['role']),
    roleOptions() {
      if (this.role === 'admin') return [{ v: 'employee', l: 'Empleado' }]
      return [
        { v: 'admin', l: 'Administrador' },
        { v: 'provider', l: 'Proveedor' },
        { v: 'employee', l: 'Empleado' },
        { v: 'sysadmin', l: 'Admin Sistema' },
      ]
    },
    isEdit() { return !!this.form.id },
  },
  mounted() { this.load(); this.loadAdmins() },
  methods: {
    roleLabel(r) { return ROLE_LABEL[r] || r },
    async load() {
      this.loading = true
      try {
        const { data } = await api.get('/users', { params: { ...this.filters, page: this.page, limit: 20 } })
        this.rows = data.data
        this.meta = data.meta
      } catch (e) { useUiStore().error(e.userMessage) } finally { this.loading = false }
    },
    async loadAdmins() {
      if (this.role !== 'sysadmin') return
      try {
        const { data } = await api.get('/users', { params: { role: 'admin', limit: 100 } })
        this.admins = data.data
      } catch (e) { /* ignore */ }
    },
    onSearch() { this.page = 1; this.load() },
    changePage(p) { this.page = p; this.load() },
    openCreate() {
      this.form = { firstName: '', lastName: '', email: '', username: '', password: '', role: this.roleOptions[0].v, phone: '', administratorId: '' }
      this.errors = {}
      this.showModal = true
    },
    openEdit(u) {
      this.form = { id: u.id, firstName: u.firstName, lastName: u.lastName, email: u.email, username: u.username, role: u.role, phone: u.phone, password: '' }
      this.errors = {}
      this.showModal = true
    },
    async save() {
      this.saving = true; this.errors = {}
      try {
        const payload = { ...this.form }
        if (!payload.administratorId) delete payload.administratorId
        if (this.isEdit) {
          if (!payload.password) delete payload.password
          await api.put(`/users/${payload.id}`, payload)
          useUiStore().success('Usuario actualizado')
        } else {
          await api.post('/users', payload)
          useUiStore().success('Usuario creado')
        }
        this.showModal = false
        this.load()
      } catch (e) {
        this.errors = e.details || {}
        useUiStore().error(e.userMessage)
      } finally { this.saving = false }
    },
    async toggleStatus(u) {
      const status = u.status === 'active' ? 'inactive' : 'active'
      this.togglingId = u.id
      try {
        await api.patch(`/users/${u.id}/status`, { status })
        useUiStore().success('Estado actualizado')
        await this.load()
      } catch (e) { useUiStore().error(e.userMessage) } finally { this.togglingId = null }
    },
  },
}
</script>

<template>
  <div>
    <div class="page-header">
      <div><h1>Usuarios</h1><p>Gestion de usuarios del sistema</p></div>
      <button class="btn btn-primary" @click="openCreate">+ Nuevo usuario</button>
    </div>

    <div class="toolbar">
      <input v-model="filters.search" class="input search-input" placeholder="Buscar nombre, email..." @keyup.enter="onSearch" />
      <select v-model="filters.role" class="select" style="max-width:180px" @change="onSearch">
        <option value="">Todos los roles</option>
        <option v-for="o in roleOptions" :key="o.v" :value="o.v">{{ o.l }}</option>
      </select>
      <select v-model="filters.status" class="select" style="max-width:160px" @change="onSearch">
        <option value="">Todos</option>
        <option value="active">Activos</option>
        <option value="inactive">Inactivos</option>
      </select>
      <button class="btn" @click="onSearch">Buscar</button>
    </div>

    <DataTable :columns="columns" :rows="rows" :loading="loading">
      <template #cell-name="{ row }">{{ row.firstName }} {{ row.lastName }}</template>
      <template #cell-role="{ row }"><span class="badge blue">{{ roleLabel(row.role) }}</span></template>
      <template #cell-status="{ row }"><StatusBadge :status="row.status" /></template>
      <template #cell-actions="{ row }">
        <div class="actions" style="justify-content:flex-end">
          <button class="btn btn-sm" @click="openEdit(row)">Editar</button>
          <button class="btn btn-sm" :disabled="togglingId === row.id" @click="toggleStatus(row)">
            <span v-if="togglingId === row.id" class="spinner dark"></span>
            {{ row.status === 'active' ? 'Desactivar' : 'Activar' }}
          </button>
        </div>
      </template>
      <template #footer><Pagination :meta="meta" @change="changePage" /></template>
    </DataTable>

    <BaseModal v-if="showModal" :title="isEdit ? 'Editar usuario' : 'Nuevo usuario'" @close="showModal = false">
      <div class="form-grid">
        <div class="field">
          <label>Nombre <span class="req">*</span></label>
          <input v-model="form.firstName" class="input" />
          <div v-if="errors.firstName" class="field-error">{{ errors.firstName }}</div>
        </div>
        <div class="field">
          <label>Apellido <span class="req">*</span></label>
          <input v-model="form.lastName" class="input" />
          <div v-if="errors.lastName" class="field-error">{{ errors.lastName }}</div>
        </div>
        <div class="field">
          <label>Email <span class="req">*</span></label>
          <input v-model="form.email" class="input" type="email" />
          <div v-if="errors.email" class="field-error">{{ errors.email }}</div>
        </div>
        <div class="field">
          <label>Usuario <span class="req">*</span></label>
          <input v-model="form.username" class="input" />
          <div v-if="errors.username" class="field-error">{{ errors.username }}</div>
        </div>
        <div class="field">
          <label>Rol <span class="req">*</span></label>
          <select v-model="form.role" class="select" :disabled="isEdit && role !== 'sysadmin'">
            <option v-for="o in roleOptions" :key="o.v" :value="o.v">{{ o.l }}</option>
          </select>
        </div>
        <div class="field" v-if="role === 'sysadmin' && form.role === 'employee'">
          <label>Administrador asociado</label>
          <select v-model="form.administratorId" class="select">
            <option value="">Seleccione...</option>
            <option v-for="a in admins" :key="a.id" :value="a.id">{{ a.firstName }} {{ a.lastName }}</option>
          </select>
        </div>
        <div class="field">
          <label>Telefono</label>
          <input v-model="form.phone" class="input" />
        </div>
        <div class="field">
          <label>{{ isEdit ? 'Nueva contrasena (opcional)' : 'Contrasena' }} <span v-if="!isEdit" class="req">*</span></label>
          <input v-model="form.password" class="input" type="password" />
          <div v-if="errors.password" class="field-error">{{ errors.password }}</div>
        </div>
      </div>
      <template #footer>
        <button class="btn" @click="showModal = false">Cancelar</button>
        <button class="btn btn-primary" :disabled="saving" @click="save">
          <span v-if="saving" class="spinner"></span> Guardar
        </button>
      </template>
    </BaseModal>
  </div>
</template>
