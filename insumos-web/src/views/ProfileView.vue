<script>
import { mapState } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import api from '@/services/api'

const ROLE_LABEL = { sysadmin: 'Administrador del Sistema', admin: 'Administrador', provider: 'Proveedor', employee: 'Empleado' }

export default {
  name: 'ProfileView',
  data() {
    return { pwd: { currentPassword: '', newPassword: '', confirm: '' }, saving: false, errors: {} }
  },
  computed: {
    ...mapState(useAuthStore, ['user', 'fullName', 'initials']),
    roleLabel() { return ROLE_LABEL[this.user?.role] || '' },
  },
  methods: {
    async changePassword() {
      this.errors = {}
      if (this.pwd.newPassword !== this.pwd.confirm) { this.errors.confirm = 'Las contrasenas no coinciden'; return }
      if (this.pwd.newPassword.length < 6) { this.errors.newPassword = 'Minimo 6 caracteres'; return }
      this.saving = true
      try {
        await api.put('/auth/change-password', { currentPassword: this.pwd.currentPassword, newPassword: this.pwd.newPassword })
        useUiStore().success('Contrasena actualizada')
        this.pwd = { currentPassword: '', newPassword: '', confirm: '' }
      } catch (e) { useUiStore().error(e.userMessage) } finally { this.saving = false }
    },
  },
}
</script>

<template>
  <div>
    <div class="page-header"><div><h1>Mi perfil</h1></div></div>

    <div class="grid-2">
      <div class="card card-pad">
        <div class="row" style="gap:16px;align-items:center" v-if="user">
          <div class="avatar" style="width:64px;height:64px;font-size:24px">{{ initials }}</div>
          <div>
            <h3>{{ fullName }}</h3>
            <p class="muted">{{ roleLabel }}</p>
          </div>
        </div>
        <div class="mt-4" v-if="user">
          <div class="row" style="justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--c-border)"><span class="muted">Email</span><span>{{ user.email }}</span></div>
          <div class="row" style="justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--c-border)"><span class="muted">Usuario</span><span>{{ user.username }}</span></div>
        </div>
      </div>

      <div class="card card-pad">
        <h3 class="mb-4">Cambiar contrasena</h3>
        <form @submit.prevent="changePassword">
          <div class="field">
            <label>Contrasena actual</label>
            <input v-model="pwd.currentPassword" class="input" type="password" />
          </div>
          <div class="field">
            <label>Nueva contrasena</label>
            <input v-model="pwd.newPassword" class="input" type="password" />
            <div v-if="errors.newPassword" class="field-error">{{ errors.newPassword }}</div>
          </div>
          <div class="field">
            <label>Confirmar nueva contrasena</label>
            <input v-model="pwd.confirm" class="input" type="password" />
            <div v-if="errors.confirm" class="field-error">{{ errors.confirm }}</div>
          </div>
          <button class="btn btn-primary" type="submit" :disabled="saving"><span v-if="saving" class="spinner"></span> Actualizar contrasena</button>
        </form>
      </div>
    </div>
  </div>
</template>
