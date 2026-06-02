import api from './api'

/**
 * Descarga un Excel desde GET /export/... respetando filtros actuales del listado.
 */
export async function downloadExcel(path, params = {}, filename = 'listado') {
  const res = await api.get(path, {
    params,
    responseType: 'blob',
    timeout: 120000,
  })
  const blob = new Blob([res.data], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${filename}.xlsx`
  a.click()
  window.URL.revokeObjectURL(url)
}
