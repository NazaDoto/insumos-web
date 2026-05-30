<script>
import BaseModal from './BaseModal.vue'

export default {
  name: 'ConfirmDialog',
  components: { BaseModal },
  props: {
    title: { type: String, default: 'Confirmar acción' },
    message: { type: String, default: '¿Está seguro?' },
    confirmText: { type: String, default: 'Confirmar' },
    danger: { type: Boolean, default: false },
    loading: { type: Boolean, default: false },
  },
  emits: ['confirm', 'cancel'],
}
</script>

<template>
  <BaseModal :title="title" @close="$emit('cancel')">
    <p>{{ message }}</p>
    <template #footer>
      <button class="btn" @click="$emit('cancel')">Cancelar</button>
      <button :class="['btn', danger ? 'btn-danger' : 'btn-primary']" :disabled="loading" @click="$emit('confirm')">
        <span v-if="loading" class="spinner"></span>
        {{ confirmText }}
      </button>
    </template>
  </BaseModal>
</template>
