<script>
export default {
  name: 'Pagination',
  props: {
    meta: { type: Object, default: () => ({ page: 1, pages: 1, total: 0 }) },
  },
  emits: ['change'],
  methods: {
    go(p) {
      if (p < 1 || p > this.meta.pages || p === this.meta.page) return
      this.$emit('change', p)
    },
  },
}
</script>

<template>
  <div class="pagination" v-if="meta.total">
    <span class="muted" style="margin-right:auto">{{ meta.total }} registro(s)</span>
    <button class="btn btn-sm" :disabled="meta.page <= 1" @click="go(meta.page - 1)">Anterior</button>
    <span class="muted">Pag. {{ meta.page }} / {{ meta.pages }}</span>
    <button class="btn btn-sm" :disabled="meta.page >= meta.pages" @click="go(meta.page + 1)">Siguiente</button>
  </div>
</template>
