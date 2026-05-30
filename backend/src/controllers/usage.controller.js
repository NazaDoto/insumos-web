import pool, { withTransaction } from '../config/db.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { ROLES } from '../middlewares/authorize.js';
import { writeLog, reqMeta } from '../utils/audit.js';
import { getPagination, buildMeta } from '../utils/pagination.js';
import { applyStockDelta, recordMovement } from '../services/stock.service.js';
import { saveCustomValues, loadCustomValues } from '../utils/customValues.js';

function scopeWhere(req, params) {
  if (req.user.role === ROLES.EMPLOYEE) {
    params.emp = req.user.id;
    return 'r.employee_id = :emp';
  }
  if (req.user.role === ROLES.ADMIN) {
    params.adminId = req.user.id;
    return "r.item_id IN (SELECT id FROM items WHERE owner_type='administrator' AND owner_id = :adminId)";
  }
  return '1=1';
}

export const list = asyncHandler(async (req, res) => {
  const { page, limit, offset } = getPagination(req.query);
  const params = { limit, offset };
  const where = [scopeWhere(req, params)];
  if (req.query.branchId) {
    where.push('r.branch_id = :branchId');
    params.branchId = req.query.branchId;
  }
  if (req.query.from) { where.push('r.created_at >= :from'); params.from = req.query.from; }
  if (req.query.to) { where.push('r.created_at <= :to'); params.to = req.query.to; }
  const whereSql = `WHERE ${where.join(' AND ')}`;

  const [rows] = await pool.execute(
    `SELECT r.*, i.name AS item_name, i.unit, b.name AS branch_name,
            CONCAT(u.first_name,' ',u.last_name) AS employee_name
     FROM usage_records r
     JOIN items i ON i.id = r.item_id
     JOIN branches b ON b.id = r.branch_id
     JOIN users u ON u.id = r.employee_id
     ${whereSql}
     ORDER BY r.created_at DESC LIMIT ${limit} OFFSET ${offset}`,
    params
  );
  const [[{ total }]] = await pool.execute(`SELECT COUNT(*) AS total FROM usage_records r ${whereSql}`, params);
  res.json({ success: true, data: rows, meta: buildMeta(page, limit, total) });
});

export const myHistory = asyncHandler(async (req, res) => {
  const [rows] = await pool.execute(
    `SELECT r.*, i.name AS item_name, i.unit, b.name AS branch_name
     FROM usage_records r
     JOIN items i ON i.id=r.item_id JOIN branches b ON b.id=r.branch_id
     WHERE r.employee_id=:emp ORDER BY r.created_at DESC LIMIT 200`,
    { emp: req.user.id }
  );
  res.json({ success: true, data: rows });
});

export const getOne = asyncHandler(async (req, res) => {
  const [rows] = await pool.execute(
    `SELECT r.*, i.name AS item_name, i.unit, b.name AS branch_name,
            CONCAT(u.first_name,' ',u.last_name) AS employee_name
     FROM usage_records r
     JOIN items i ON i.id=r.item_id JOIN branches b ON b.id=r.branch_id JOIN users u ON u.id=r.employee_id
     WHERE r.id=:id`,
    { id: req.params.id }
  );
  const rec = rows[0];
  if (!rec) throw ApiError.notFound('Registro no encontrado');
  if (req.user.role === ROLES.EMPLOYEE && rec.employee_id !== req.user.id)
    throw ApiError.forbidden('Sin acceso');
  const customValues = await loadCustomValues('usage', rec.id);
  res.json({ success: true, data: { ...rec, customValues } });
});

export const create = asyncHandler(async (req, res) => {
  const { itemId, branchId, quantity, usedWhere, usedFor, recipient, observations, customValues } = req.body;

  // El empleado solo puede registrar en sus sucursales asignadas.
  if (req.user.role === ROLES.EMPLOYEE) {
    const [eb] = await pool.execute(
      'SELECT 1 FROM employee_branches WHERE user_id=:u AND branch_id=:b',
      { u: req.user.id, b: branchId }
    );
    if (!eb[0]) throw ApiError.forbidden('No esta asignado a esta sucursal');
  }

  const id = await withTransaction(async (conn) => {
    // Descuenta stock (valida disponibilidad dentro de la transaccion).
    await applyStockDelta(conn, { itemId, branchId, delta: -Math.abs(quantity) });

    const [r] = await conn.execute(
      `INSERT INTO usage_records (item_id, branch_id, employee_id, quantity, used_where, used_for, recipient, observations)
       VALUES (:i,:b,:e,:q,:uw,:uf,:rc,:obs)`,
      {
        i: itemId, b: branchId, e: req.user.id, q: quantity,
        uw: usedWhere || null, uf: usedFor || null, rc: recipient || null, obs: observations || null,
      }
    );
    await recordMovement(conn, {
      itemId, type: 'usage', quantity, originBranchId: branchId,
      usageRecordId: r.insertId, reason: usedFor || 'Uso de insumo', createdBy: req.user.id,
    });
    await saveCustomValues('usage', r.insertId, customValues, conn);
    return r.insertId;
  });

  await writeLog({ ...reqMeta(req), action: 'usage_register', module: 'usage', recordId: id, newValue: { itemId, branchId, quantity } });
  res.status(201).json({ success: true, data: { id } });
});
