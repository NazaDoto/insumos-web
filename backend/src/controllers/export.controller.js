import asyncHandler from '../utils/asyncHandler.js';
import { sendExcelDownload } from '../utils/excelExport.js';
import * as exportService from '../services/export.service.js';

function makeExport(fetchRows, baseFilename, sheetName) {
  return asyncHandler(async (req, res) => {
    const rows = await fetchRows(req);
    const ts = new Date().toISOString().slice(0, 10);
    await sendExcelDownload(res, {
      rows,
      filename: `${baseFilename}_${ts}.xlsx`,
      sheetName,
    });
  });
}

export const users = makeExport(exportService.exportUsers, 'usuarios', 'Usuarios');
export const items = makeExport(exportService.exportItems, 'insumos', 'Insumos');
export const categories = makeExport(exportService.exportCategories, 'categorias', 'Categorías');
export const branches = makeExport(exportService.exportBranches, 'sucursales', 'Sucursales');
export const stock = makeExport(exportService.exportStock, 'stock', 'Stock');
export const movements = makeExport(exportService.exportMovements, 'movimientos', 'Movimientos');
export const orders = makeExport(exportService.exportOrders, 'pedidos', 'Pedidos');
export const usage = makeExport(exportService.exportUsage, 'uso_insumos', 'Uso de insumos');
export const logs = makeExport(exportService.exportLogs, 'logs', 'Logs');
export const providers = makeExport(exportService.exportProviders, 'proveedores', 'Proveedores');
export const providerCatalog = makeExport(exportService.exportProviderCatalog, 'mi_stock', 'Mi stock');
export const customFields = makeExport(exportService.exportCustomFields, 'atributos', 'Atributos');
