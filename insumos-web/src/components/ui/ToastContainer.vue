<script>
import { mapState } from 'pinia'
import { useUiStore } from '@/stores/ui'

export default {
  name: 'ToastContainer',
  computed: { ...mapState(useUiStore, ['toasts']) },
  methods: {
    icon(type) {
      return { success: '\u2713', error: '\u2715', warning: '\u26A0', info: '\u2139' }[type] || ''
    },
    close(id) { useUiStore().dismiss(id) },
  },
}
</script>

<template>
  <div class="toast-container">
    <div v-for="t in toasts" :key="t.id" :class="['toast', t.type]" @click="close(t.id)">
      <span>{{ icon(t.type) }}</span>
      <span>{{ t.message }}</span>
    </div>
  </div>
</template>
