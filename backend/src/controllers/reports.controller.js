import ExcelJS from 'exceljs';
import pool from '../config/db.js';
import asyncHandler from '../utils/asyncHandler.js';
import { ROLES } from '../middlewares/authorize.js';

// Filtro base de propiedad para reportes (admin limitado a sus recursos).
function adminScopeStock(req, params) {
  if (req.user.role === ROLES.ADMIN) {
    params.adminId = req.user.id;
    return 'b.administrator_id = :adminId';
  }
  return '1=1';
}

async function queryStock(req) {
  const params = {};
  const where = [adminScopeStock(req, params)];
  if (req.query.branchId) { where.push('s.branch_id = :branchId'); params.branchId = req.query.branchId; }
  if (req.query.categoryId) { where.push('i.category_id = :categoryId'); params.categoryId = req.query.categoryId; }
  const [rows] = await pool.execute(
    `SELECT i.name AS insumo, c.name AS categoria, b.name AS sucursal, i.unit AS unidad,
            s.quantity AS cantidad, i.minimum_stock AS stock_minimo,
            CASE WHEN s.quantity <= i.minimum_stock THEN 'SI' ELSE 'NO' END AS bajo_stock
     FROM stock s JOIN items i ON i.id=s.item_id
     LEFT JOIN item_categories c ON c.id=i.category_id
     LEFT JOIN branches b ON b.id=s.branch_id
     WHERE ${where.join(' AND ')} AND s.branch_id IS NOT NULL
     ORDER BY i.name`,
    params
  );
  return rows;
}

async function queryLowStock(req) {
  const params = {};
  const where = [adminScopeStock(req, params), 's.quantity <= i.minimum_stock'];
  const [rows] = await pool.execute(
    `SELECT i.name AS insumo, b.name AS sucursal, s.quantity AS cantidad,
            i.minimum_stock AS stock_minimo, i.unit AS unidad
     FROM stock s JOIN items i ON i.id=s.item_id LEFT JOIN branches b ON b.id=s.branch_id
     WHERE ${where.join(' AND ')} ORDER BY s.quantity`,
    params
  );
  return rows;
}

async function queryOrders(req) {
  const params = {};
  const where = [];
  if (req.user.role === ROLES.ADMIN) { where.push('o.administrator_id=:adminId'); params.adminId = req.user.id; }
  if (req.user.role === ROLES.PROVIDER) { where.push('o.provider_id=:provId'); params.provId = req.user.id; }
  if (req.query.status) { where.push('o.status=:status'); params.status = req.query.status; }
  if (req.query.from) { where.push('o.created_at>=:from'); params.from = req.query.from; }
  if (req.query.to) { where.push('o.created_at<=:to'); params.to = req.query.to; }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const [rows] = await pool.execute(
    `SELECT o.id AS pedido, o.status AS estado, o.created_at AS fecha,
            CONCAT(a.first_name,' ',a.last_name) AS administrador,
            CONCAT(p.first_name,' ',p.last_name) AS proveedor
     FROM orders o JOIN users a ON a.id=o.administrator_id JOIN users p ON p.id=o.provider_id
     ${whereSql} ORDER BY o.created_at DESC`,
    params
  );
  return rows;
}

async function queryUsage(req) {
  const params = {};
  const where = [];
  if (req.user.role === ROLES.ADMIN) {
    where.push("r.item_id IN (SELECT id FROM items WHERE owner_type='administrator' AND owner_id=:adminId)");
    params.adminId = req.user.id;
  }
  if (req.user.role === ROLES.EMPLOYEE) { where.push('r.employee_id=:emp'); params.emp = req.user.id; }
  if (req.query.from) { where.push('r.created_at>=:from'); params.from = req.query.from; }
  if (req.query.to) { where.push('r.created_at<=:to'); params.to = req.query.to; }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const [rows] = await pool.execute(
    `SELECT i.name AS insumo, b.name AS sucursal, CONCAT(u.first_name,' ',u.last_name) AS empleado,
            r.quantity AS cantidad, r.used_where AS lugar, r.used_for AS motivo, r.created_at AS fecha
     FROM usage_records r JOIN items i ON i.id=r.item_id JOIN branches b ON b.id=r.branch_id
     JOIN users u ON u.id=r.employee_id ${whereSql} ORDER BY r.created_at DESC`,
    params
  );
  return rows;
}

async function queryMovements(req) {
  const params = {};
  const where = [];
  if (req.user.role === ROLES.ADMIN) {
    where.push("m.item_id IN (SELECT id FROM items WHERE owner_type='administrator' AND owner_id=:adminId)");
    params.adminId = req.user.id;
  }
  if (req.query.type) { where.push('m.movement_type=:type'); params.type = req.query.type; }
  if (req.query.from) { where.push('m.created_at>=:from'); params.from = req.query.from; }
  if (req.query.to) { where.push('m.created_at<=:to'); params.to = req.query.to; }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const [rows] = await pool.execute(
    `SELECT i.name AS insumo, m.movement_type AS tipo, m.quantity AS cantidad,
            ob.name AS origen, db.name AS destino, m.reason AS motivo, m.created_at AS fecha
     FROM stock_movements m JOIN items i ON i.id=m.item_id
     LEFT JOIN branches ob ON ob.id=m.origin_branch_id
     LEFT JOIN branches db ON db.id=m.destination_branch_id
     ${whereSql} ORDER BY m.created_at DESC LIMIT 1000`,
    params
  );
  return rows;
}

const REPORTS = {
  stock: queryStock,
  'low-stock': queryLowStock,
  orders: queryOrders,
  usage: queryUsage,
  movements: queryMovements,
};

function makeHandler(key) {
  return asyncHandler(async (req, res) => {
    const data = await REPORTS[key](req);
    res.json({ success: true, data });
  });
}

export const stock = makeHandler('stock');
export const lowStock = makeHandler('low-stock');
export const orders = makeHandler('orders');
export const usage = makeHandler('usage');
export const movements = makeHandler('movements');

export const exportExcel = asyncHandler(async (req, res) => {
  const type = req.query.type || 'stock';
  const fn = REPORTS[type] || REPORTS.stock;
  const data = await fn(req);

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Sistema de Insumos';
  const ws = wb.addWorksheet(type);

  if (data.length) {
    const headers = Object.keys(data[0]);
    ws.columns = headers.map((h) => ({ header: h.toUpperCase(), key: h, width: 22 }));
    ws.addRows(data);
    ws.getRow(1).font = { bold: true };
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
    ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  } else {
    ws.addRow(['Sin datos para los filtros seleccionados']);
  }

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="reporte_${type}_${Date.now()}.xlsx"`);
  await wb.xlsx.write(res);
  res.end();
});
