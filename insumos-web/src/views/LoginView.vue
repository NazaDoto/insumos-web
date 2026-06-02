<script>
import { mapActions } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import AppIcon from '@/components/icons/AppIcon.vue'

export default {
  name: 'LoginView',
  components: { AppIcon },
  data() {
    return { identifier: '', password: '', loading: false, error: '' }
  },
  mounted() {
    if (this.$route.query.expired) {
      useUiStore().warning('Su sesión expiró, vuelva a iniciar sesión')
    }
  },
  methods: {
    ...mapActions(useAuthStore, ['login']),
    async submit() {
      this.error = ''
      if (!this.identifier || !this.password) {
        this.error = 'Complete usuario y contraseña'
        return
      }
      this.loading = true
      try {
        await this.login(this.identifier.trim(), this.password)
        useUiStore().success('Bienvenido')
        const redirect = this.$route.query.redirect || '/dashboard'
        this.$router.push(redirect)
      } catch (e) {
        this.error = e.userMessage || 'No se pudo iniciar sesión'
      } finally {
        this.loading = false
      }
    },
  },
}
</script>

<template>
  <div class="login-wrap">
    <form class="login-card" @submit.prevent="submit">
      <div class="login-brand">
        <div class="login-logo">
          <AppIcon name="box-seam-fill" :size="28" />
        </div>
        <h1>Gestión de Insumos</h1>
        <p class="sub">Ingrese sus credenciales para continuar</p>
      </div>

      <div class="field">
        <label>Email o usuario</label>
        <input v-model="identifier" class="input" type="text" placeholder="usuario@dominio.com" autocomplete="username" />
      </div>
      <div class="field">
        <label>Contraseña</label>
        <input v-model="password" class="input" type="password" placeholder="********" autocomplete="current-password" />
      </div>

      <div v-if="error" class="field-error mb-4">{{ error }}</div>

      <button class="btn btn-primary btn-block" type="submit" :disabled="loading">
        <span v-if="loading" class="spinner"></span>
        {{ loading ? 'Ingresando...' : 'Iniciar sesión' }}
      </button>
    </form>
  </div>
</template>
