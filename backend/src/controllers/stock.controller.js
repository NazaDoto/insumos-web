import pool, { withTransaction } from '../config/db.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { ROLES } from '../middlewares/authorize.js';
import { writeLog, reqMeta } from '../utils/audit.js';
import { getPagination, buildMeta } from '../utils/pagination.js';
import { applyStockDelta, recordMovement } from '../services/stock.service.js';

// Verifica que el insumo pertenezca al admin actual (o sysadmin).
async function assertItem(conn, req, itemId) {
  const [rows] = await conn.execute('SELECT * FROM items WHERE id=:id', { id: itemId });
  const item = rows[0];
  if (!item) throw ApiError.notFound('Insumo no encontrado');
  if (req.user.role === ROLES.ADMIN && !(item.owner_type === 'administrator' && item.owner_id === req.user.id))
    throw ApiError.forbidden('El insumo no le pertenece');
  return item;
}

async function assertBranch(conn, req, branchId) {
  const [rows] = await conn.execute('SELECT * FROM branches WHERE id=:id', { id: branchId });
  const b = rows[0];
  if (!b) throw ApiError.notFound('Sucursal no encontrada');
  if (req.user.role === ROLES.ADMIN && b.administrator_id !== req.user.id)
    throw ApiError.forbidden('La sucursal no le pertenece');
  return b;
}

function adminFilter(req, params) {
  if (req.user.role === ROLES.ADMIN) {
    params.adminId = req.user.id;
    return 'b.administrator_id = :adminId';
  }
  if (req.user.role === ROLES.EMPLOYEE) {
    params.emp = req.user.id;
    return 's.branch_id IN (SELECT branch_id FROM employee_branches WHERE user_id = :emp)';
  }
  return '1=1';
}

export const list = asyncHandler(async (req, res) => {
  const params = {};
  const where = [adminFilter(req, params)];
  if (req.query.branchId) {
    where.push('s.branch_id = :branchId');
    params.branchId = req.query.branchId;
  }
  if (req.query.search) {
    where.push('i.name LIKE :s');
    params.s = `%${req.query.search}%`;
  }
  if (req.query.lowStock === 'true') {
    where.push('s.quantity <= i.minimum_stock');
  }

  const [rows] = await pool.execute(
    `SELECT s.id, s.quantity, s.updated_at,
            i.id AS item_id, i.name AS item_name, i.unit, i.minimum_stock,
            b.id AS branch_id, b.name AS branch_name,
            (s.quantity <= i.minimum_stock) AS low_stock
     FROM stock s
     JOIN items i ON i.id = s.item_id
     LEFT JOIN branches b ON b.id = s.branch_id
     WHERE ${where.join(' AND ')} AND s.branch_id IS NOT NULL
     ORDER BY i.name`,
    params
  );
  res.json({ success: true, data: rows });
});

export const movements = asyncHandler(async (req, res) => {
  const { page, limit, offset } = getPagination(req.query);
  const params = { limit, offset };
  const where = [];

  if (req.user.role === ROLES.ADMIN) {
    where.push(`m.item_id IN (SELECT id FROM items WHERE owner_type='administrator' AND owner_id = :adminId)`);
    params.adminId = req.user.id;
  } else if (req.user.role === ROLES.EMPLOYEE) {
    where.push('m.created_by = :emp');
    params.emp = req.user.id;
  }
  if (req.query.type) {
    where.push('m.movement_type = :type');
    params.type = req.query.type;
  }
  if (req.query.from) {
    where.push('m.created_at >= :from');
    params.from = req.query.from;
  }
  if (req.query.to) {
    where.push('m.created_at <= :to');
    params.to = req.query.to;
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const [rows] = await pool.execute(
    `SELECT m.*, i.name AS item_name, CONCAT(u.first_name,' ',u.last_name) AS user_name,
            ob.name AS origin_branch, db.name AS destination_branch
     FROM stock_movements m
     JOIN items i ON i.id = m.item_id
     LEFT JOIN users u ON u.id = m.created_by
     LEFT JOIN branches ob ON ob.id = m.origin_branch_id
     LEFT JOIN branches db ON db.id = m.destination_branch_id
     ${whereSql}
     ORDER BY m.created_at DESC LIMIT ${limit} OFFSET ${offset}`,
    params
  );
  const [[{ total }]] = await pool.execute(
    `SELECT COUNT(*) AS total FROM stock_movements m ${whereSql}`,
    params
  );
  res.json({ success: true, data: rows, meta: buildMeta(page, limit, total) });
});

export const income = asyncHandler(async (req, res) => {
  const { itemId, branchId, quantity, reason } = req.body;
  await withTransaction(async (conn) => {
    await assertItem(conn, req, itemId);
    await assertBranch(conn, req, branchId);
    await applyStockDelta(conn, { itemId, branchId, delta: quantity });
    await recordMovement(conn, { itemId, type: 'income', quantity, destinationBranchId: branchId, reason, createdBy: req.user.id });
  });
  await writeLog({ ...reqMeta(req), action: 'stock_income', module: 'stock', recordId: itemId, newValue: { branchId, quantity } });
  res.status(201).json({ success: true, message: 'Ingreso registrado' });
});

export const outcome = asyncHandler(async (req, res) => {
  const { itemId, branchId, quantity, reason } = req.body;
  await withTransaction(async (conn) => {
    await assertItem(conn, req, itemId);
    await assertBranch(conn, req, branchId);
    await applyStockDelta(conn, { itemId, branchId, delta: -Math.abs(quantity) });
    await recordMovement(conn, { itemId, type: 'outcome', quantity, originBranchId: branchId, reason, createdBy: req.user.id });
  });
  await writeLog({ ...reqMeta(req), action: 'stock_outcome', module: 'stock', recordId: itemId, newValue: { branchId, quantity } });
  res.status(201).json({ success: true, message: 'Egreso registrado' });
});

export const transfer = asyncHandler(async (req, res) => {
  const { itemId, originBranchId, destinationBranchId, quantity, reason } = req.body;
  if (originBranchId === destinationBranchId) throw ApiError.badRequest('Origen y destino no pueden ser iguales');
  await withTransaction(async (conn) => {
    await assertItem(conn, req, itemId);
    await assertBranch(conn, req, originBranchId);
    await assertBranch(conn, req, destinationBranchId);
    await applyStockDelta(conn, { itemId, branchId: originBranchId, delta: -Math.abs(quantity) });
    await applyStockDelta(conn, { itemId, branchId: destinationBranchId, delta: Math.abs(quantity) });
    await recordMovement(conn, {
      itemId, type: 'transfer', quantity,
      originBranchId, destinationBranchId, reason, createdBy: req.user.id,
    });
  });
  await writeLog({ ...reqMeta(req), action: 'stock_transfer', module: 'stock', recordId: itemId, newValue: { originBranchId, destinationBranchId, quantity } });
  res.status(201).json({ success: true, message: 'Transferencia registrada' });
});

export const adjustment = asyncHandler(async (req, res) => {
  const { itemId, branchId, newQuantity, reason } = req.body;
  await withTransaction(async (conn) => {
    await assertItem(conn, req, itemId);
    await assertBranch(conn, req, branchId);
    const [rows] = await conn.query(
      'SELECT quantity FROM stock WHERE item_id=? AND branch_id=? FOR UPDATE',
      [itemId, branchId]
    );
    const current = rows[0] ? Number(rows[0].quantity) : 0;
    const delta = Number(newQuantity) - current;
    await applyStockDelta(conn, { itemId, branchId, delta });
    await recordMovement(conn, {
      itemId, type: 'adjustment', quantity: Math.abs(delta),
      destinationBranchId: delta >= 0 ? branchId : null,
      originBranchId: delta < 0 ? branchId : null,
      reason: reason || `Ajuste manual a ${newQuantity}`, createdBy: req.user.id,
    });
  });
  await writeLog({ ...reqMeta(req), action: 'stock_adjustment', module: 'stock', recordId: itemId, newValue: { branchId, newQuantity } });
  res.status(201).json({ success: true, message: 'Ajuste registrado' });
});
