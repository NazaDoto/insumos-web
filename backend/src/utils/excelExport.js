import ExcelJS from 'exceljs';

/**
 * Envía un archivo .xlsx como descarga. rows: array de objetos planos (claves = columnas).
 */
export async function sendExcelDownload(res, { rows, filename, sheetName = 'Datos' }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Sistema de Insumos';
  const ws = wb.addWorksheet(sheetName.substring(0, 31));

  if (rows?.length) {
    const headers = Object.keys(rows[0]);
    ws.columns = headers.map((h) => ({ header: h, key: h, width: Math.min(36, Math.max(12, h.length + 2)) }));
    ws.addRows(rows);
    const headerRow = ws.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A56A8' } };
    headerRow.alignment = { vertical: 'middle' };
  } else {
    ws.addRow(['Sin registros para exportar']);
  }

  const safeName = String(filename || 'export').replace(/[^\w.-]+/g, '_');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
  await wb.xlsx.write(res);
  res.end();
}
