<script>
import api from '@/services/api'
import { useUiStore } from '@/stores/ui'
import AppIcon from '@/components/icons/AppIcon.vue'

export default {
  name: 'ItemsImportModal',
  components: { AppIcon },
  emits: ['close', 'done'],
  data() {
    return {
      file: null,
      dragOver: false,
      importing: false,
      downloading: false,
      progress: [],
      errors: [],
      summary: null,
      currentStep: '',
      progressPct: 0,
    }
  },
  computed: {
    canImport() {
      return !!this.file && !this.importing
    },
    hasErrors() {
      return this.errors.length > 0
    },
  },
  methods: {
    onBackdrop(e) {
      if (e.target === e.currentTarget && !this.importing) this.$emit('close')
    },
    pickFile() {
      this.$refs.fileInput?.click()
    },
    onFileChange(e) {
      const f = e.target.files?.[0]
      if (f) this.setFile(f)
      e.target.value = ''
    },
    onDrop(e) {
      e.preventDefault()
      this.dragOver = false
      const f = e.dataTransfer.files?.[0]
      if (f) this.setFile(f)
    },
    setFile(f) {
      if (!/\.xlsx$/i.test(f.name)) {
        useUiStore().warning('Use un archivo Excel (.xlsx)')
        return
      }
      this.file = f
      this.progress = []
      this.errors = []
      this.summary = null
    },
    clearFile() {
      this.file = null
      this.progress = []
      this.errors = []
      this.summary = null
    },
    async downloadTemplate() {
      this.downloading = true
      try {
        const res = await api.get('/items/import/template', { responseType: 'blob' })
        const url = window.URL.createObjectURL(new Blob([res.data]))
        const a = document.createElement('a')
        a.href = url
        a.download = 'plantilla_insumos.xlsx'
        a.click()
        window.URL.revokeObjectURL(url)
      } catch (e) {
        useUiStore().error(e.userMessage || 'No se pudo descargar la plantilla')
      } finally {
        this.downloading = false
      }
    },
    labelForEvent(ev) {
      if (ev.type === 'start') return `Procesando ${ev.total} filas...`
      if (ev.type === 'row') {
        const act = ev.action === 'created' ? 'Creado' : 'Actualizado'
        let s = `Fila ${ev.row}: ${act} — ${ev.name}`
        if (ev.externalRefId) s += ` (ref: ${ev.externalRefId})`
        if (ev.stock?.movement) {
          s += ` · Stock ${ev.stock.movement === 'income' ? '+' : '-'}${ev.stock.quantity}`
        }
        return s
      }
      if (ev.type === 'error') {
        return `Fila ${ev.row}: ${(ev.messages || []).join('; ')}`
      }
      if (ev.type === 'done') {
        const x = ev.summary
        return `Finalizado: ${x.created} creados, ${x.updated} actualizados, ${x.errors} error(es)`
      }
      return ''
    },
    async animateEvents(events) {
      const actionable = events.filter((e) => ['start', 'row', 'error', 'done'].includes(e.type))
      const total = actionable.length || 1
      let i = 0
      for (const ev of events) {
        if (!['start', 'row', 'error', 'done'].includes(ev.type)) continue
        this.currentStep = this.labelForEvent(ev)
        if (ev.type === 'row' || ev.type === 'error') {
          this.progress.unshift({ ...ev, label: this.currentStep })
        } else if (ev.type === 'start') {
          this.progress = [{ ...ev, label: this.currentStep }]
        }
        i += 1
        this.progressPct = Math.round((i / total) * 100)
        await new Promise((r) => setTimeout(r, ev.type === 'row' ? 40 : 20))
      }
    },
    async doImport() {
      if (!this.file) return
      this.importing = true
      this.progress = []
      this.errors = []
      this.summary = null
      this.progressPct = 0
      this.currentStep = 'Subiendo archivo...'

      const form = new FormData()
      form.append('file', this.file)

      try {
        const { data } = await api.post('/items/import', form, {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 120000,
        })
        this.errors = data.errors || []
        this.summary = data.summary
        await this.animateEvents(data.events || [])

        if (data.summary?.errors) {
          useUiStore().warning(
            `Importación con ${data.summary.errors} error(es). Revise el detalle.`
          )
        } else {
          useUiStore().success('Importación completada correctamente')
          this.$emit('done')
        }
      } catch (e) {
        useUiStore().error(e.userMessage || 'Error al importar')
        if (e.details) this.errors = Array.isArray(e.details) ? e.details : []
      } finally {
        this.importing = false
        this.currentStep = ''
        this.progressPct = 100
      }
    },
  },
}
</script>

<template>
  <div class="modal-backdrop" @mousedown="onBackdrop">
    <div class="modal lg import-modal" @mousedown.stop>
      <div class="modal-header">
        <h3>Importar insumos desde Excel</h3>
        <button type="button" class="btn btn-ghost btn-sm btn-icon" :disabled="importing" aria-label="Cerrar" @click="$emit('close')">
          <AppIcon name="x-lg" :size="18" />
        </button>
      </div>

      <div class="modal-body">
        <div class="import-help card-pad" style="padding:14px;margin-bottom:16px;background:#f8fafc">
          <p style="font-weight:600;margin-bottom:8px">Cómo importar</p>
          <ol class="import-steps">
            <li>Descargá la <button type="button" class="btn-link" :disabled="downloading" @click="downloadTemplate">
              {{ downloading ? 'Descargando...' : 'plantilla Excel' }}
            </button>.</li>
            <li>Completá las filas. <strong>id_externo</strong> es el código de su sistema: si vuelve a importar, se <strong>actualizan</strong> los insumos con el mismo id.</li>
            <li><strong>nombre</strong> es obligatorio. Si indica <strong>stock</strong>, debe indicar <strong>sucursal</strong> (nombre exacto de una sucursal activa).</li>
            <li>Al importar con stock, se registra un <strong>ingreso</strong> (en actualizaciones se ajusta al valor del archivo).</li>
          </ol>
          <p class="muted" style="font-size:12px;margin-top:10px">
            Columnas: id_externo, nombre, descripcion, categoria, unidad, stock_minimo, estado, condicion, sucursal, stock
          </p>
        </div>

        <div
          :class="['import-dropzone', { over: dragOver, filled: !!file }]"
          @dragover.prevent="dragOver = true"
          @dragleave.prevent="dragOver = false"
          @drop="onDrop"
          @click="pickFile"
        >
          <input ref="fileInput" type="file" accept=".xlsx" hidden @change="onFileChange" />
          <AppIcon name="box-seam" :size="32" />
          <p v-if="!file" class="dz-title">Arrastrá el archivo .xlsx aquí o hacé clic para elegir</p>
          <p v-else class="dz-title">{{ file.name }}</p>
          <p class="muted dz-sub">Máximo 8 MB</p>
          <button v-if="file && !importing" type="button" class="btn btn-sm mt-2" @click.stop="clearFile">Quitar archivo</button>
        </div>

        <div v-if="importing || progress.length" class="import-progress mt-4">
          <div class="import-progress-head">
            <span class="muted" style="font-size:12px">{{ currentStep || 'Procesando...' }}</span>
            <span class="muted" style="font-size:12px">{{ progressPct }}%</span>
          </div>
          <div class="import-progress-bar"><div class="import-progress-fill" :style="{ width: progressPct + '%' }"></div></div>
          <div class="import-log">
            <div
              v-for="(line, idx) in progress.slice(0, 12)"
              :key="idx"
              :class="['import-log-line', line.type === 'error' ? 'err' : line.type === 'row' ? 'ok' : '']"
            >
              {{ line.label }}
            </div>
          </div>
        </div>

        <div v-if="hasErrors && !importing" class="import-errors mt-4">
          <p style="font-weight:600;color:var(--c-danger);margin-bottom:8px">Errores a corregir en el Excel</p>
          <ul>
            <li v-for="(err, i) in errors" :key="i">
              <strong>Fila {{ err.row }}</strong>
              <span v-if="err.externalRefId"> (ref: {{ err.externalRefId }})</span>
              — <span v-if="err.field">{{ err.field }}: </span>{{ err.message }}
            </li>
          </ul>
        </div>

        <div v-if="summary && !importing" class="import-summary mt-4 card-pad" style="padding:12px;background:var(--c-primary-soft)">
          <strong>Resumen:</strong>
          {{ summary.created }} creados, {{ summary.updated }} actualizados,
          {{ summary.stockMovements }} movimiento(s) de stock,
          {{ summary.errors }} error(es).
        </div>
      </div>

      <div class="modal-footer">
        <button type="button" class="btn" :disabled="importing" @click="$emit('close')">Cancelar</button>
        <button type="button" class="btn btn-primary" :disabled="!canImport" @click="doImport">
          <span v-if="importing" class="spinner"></span>
          {{ importing ? 'Importando...' : 'Importar' }}
        </button>
      </div>
    </div>
  </div>
</template>
