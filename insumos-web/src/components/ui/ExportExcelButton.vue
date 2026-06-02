<script>
import { useUiStore } from '@/stores/ui'
import { downloadExcel } from '@/services/exportExcel'
import AppIcon from '@/components/icons/AppIcon.vue'

export default {
  name: 'ExportExcelButton',
  components: { AppIcon },
  props: {
    path: { type: String, required: true },
    params: { type: Object, default: () => ({}) },
    filename: { type: String, default: 'listado' },
    disabled: { type: Boolean, default: false },
    label: { type: String, default: 'Exportar Excel' },
  },
  data() {
    return { exporting: false }
  },
  methods: {
    async run() {
      if (this.exporting || this.disabled) return
      this.exporting = true
      try {
        await downloadExcel(this.path, this.params, this.filename)
        useUiStore().success('Excel descargado')
      } catch (e) {
        useUiStore().error(e.userMessage || 'No se pudo exportar a Excel')
      } finally {
        this.exporting = false
      }
    },
  },
}
</script>

<template>
  <button type="button" class="btn btn-success" :disabled="disabled || exporting" @click="run">
    <span v-if="exporting" class="spinner"></span>
    <template v-else>
      <AppIcon name="file-earmark-spreadsheet" :size="15" />
    </template>
    {{ exporting ? 'Exportando...' : label }}
  </button>
</template>
