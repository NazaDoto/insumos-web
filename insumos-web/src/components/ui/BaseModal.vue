<script>
export default {
  name: 'BaseModal',
  props: {
    title: { type: String, default: '' },
    large: { type: Boolean, default: false },
  },
  emits: ['close'],
  mounted() {
    document.addEventListener('keydown', this.onKey)
  },
  beforeUnmount() {
    document.removeEventListener('keydown', this.onKey)
  },
  methods: {
    onKey(e) { if (e.key === 'Escape') this.$emit('close') },
    onBackdrop(e) { if (e.target === e.currentTarget) this.$emit('close') },
  },
}
</script>

<template>
  <div class="modal-backdrop" @mousedown="onBackdrop">
    <div :class="['modal', { lg: large }]">
      <div class="modal-header">
        <h3>{{ title }}</h3>
        <button class="btn btn-ghost btn-sm" @click="$emit('close')">&times;</button>
      </div>
      <div class="modal-body">
        <slot />
      </div>
      <div v-if="$slots.footer" class="modal-footer">
        <slot name="footer" />
      </div>
    </div>
  </div>
</template>
