<script>
export default {
  name: 'DataTable',
  props: {
    columns: { type: Array, required: true }, // [{ key, label, width, align }]
    rows: { type: Array, default: () => [] },
    loading: { type: Boolean, default: false },
    emptyText: { type: String, default: 'No hay registros para mostrar' },
    rowKey: { type: String, default: 'id' },
  },
}
</script>

<template>
  <div class="card">
    <div v-if="loading" class="loading-center">
      <span class="spinner dark"></span>
    </div>
    <template v-else>
      <div class="table-wrap">
        <table class="data data-cards">
          <thead>
            <tr>
              <th v-for="col in columns" :key="col.key" :style="{ width: col.width, textAlign: col.align }">
                {{ col.label }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in rows" :key="row[rowKey]">
              <td v-for="col in columns" :key="col.key" :style="{ textAlign: col.align }" :data-label="col.label">
                <slot :name="'cell-' + col.key" :row="row" :value="row[col.key]">
                  {{ row[col.key] }}
                </slot>
              </td>
            </tr>
            <tr v-if="!rows.length" class="empty-row">
              <td :colspan="columns.length" class="empty-cell">
                <div class="table-empty">{{ emptyText }}</div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <slot name="footer" />
    </template>
  </div>
</template>
