import pool from '../config/db.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { ROLES } from '../middlewares/authorize.js';
import { writeLog, reqMeta } from '../utils/audit.js';

// Devuelve los ids de admin a los que el usuario tiene acceso de lectura.
function adminScope(req) {
  if (req.user.role === ROLES.SYSADMIN) return null; // todos
  if (req.user.role === ROLES.ADMIN) return req.user.id;
  if (req.user.role === ROLES.EMPLOYEE) return req.user.administrator_id;
  return -1;
}

export const list = asyncHandler(async (req, res) => {
  const scope = adminScope(req);
  const params = {};
  let where = '1=1';

  if (scope !== null) {
    where = 'b.administrator_id = :adminId';
    params.adminId = scope;
  }

  // Empleado: solo sus sucursales asignadas.
  if (req.user.role === ROLES.EMPLOYEE) {
    where += ' AND b.id IN (SELECT branch_id FROM employee_branches WHERE user_id = :emp)';
    params.emp = req.user.id;
  }

  const [rows] = await pool.execute(
    `SELECT b.*, CONCAT(r.first_name,' ',r.last_name) AS responsible_name
     FROM branches b
     LEFT JOIN users r ON r.id = b.responsible_user_id
     WHERE ${where} ORDER BY b.name`,
    params
  );
  res.json({ success: true, data: rows });
});

async function fetchScoped(req, id, write = false) {
  const [rows] = await pool.execute('SELECT * FROM branches WHERE id=:id', { id });
  const b = rows[0];
  if (!b) throw ApiError.notFound('Sucursal no encontrada');
  const scope = adminScope(req);
  if (scope !== null && b.administrator_id !== scope) throw ApiError.forbidden('Sin acceso a esta sucursal');
  if (write && req.user.role === ROLES.EMPLOYEE) throw ApiError.forbidden('Sin permisos de escritura');
  return b;
}

export const getOne = asyncHandler(async (req, res) => {
  const b = await fetchScoped(req, req.params.id);
  const [emps] = await pool.execute(
    `SELECT u.id, u.first_name, u.last_name, u.email FROM employee_branches eb
     JOIN users u ON u.id = eb.user_id WHERE eb.branch_id = :id`,
    { id: b.id }
  );
  res.json({ success: true, data: { ...b, employees: emps } });
});

export const create = asyncHandler(async (req, res) => {
  const { name, description, address, responsibleUserId } = req.body;
  const administratorId = req.user.role === ROLES.ADMIN ? req.user.id : req.body.administratorId;
  if (!administratorId) throw ApiError.badRequest('administratorId requerido');

  const [r] = await pool.execute(
    `INSERT INTO branches (administrator_id, name, description, address, responsible_user_id)
     VALUES (:a,:n,:d,:addr,:resp)`,
    { a: administratorId, n: name, d: description || null, addr: address || null, resp: responsibleUserId || null }
  );
  await writeLog({ ...reqMeta(req), action: 'create', module: 'branches', recordId: r.insertId, newValue: { name } });
  res.status(201).json({ success: true, data: { id: r.insertId } });
});

export const update = asyncHandler(async (req, res) => {
  const b = await fetchScoped(req, req.params.id, true);
  const { name, description, address, responsibleUserId, status } = req.body;
  await pool.execute(
    `UPDATE branches SET name=:n, description=:d, address=:addr, responsible_user_id=:resp, status=:s WHERE id=:id`,
    {
      n: name ?? b.name,
      d: description ?? b.description,
      addr: address ?? b.address,
      resp: responsibleUserId ?? b.responsible_user_id,
      s: status ?? b.status,
      id: b.id,
    }
  );
  await writeLog({ ...reqMeta(req), action: 'update', module: 'branches', recordId: b.id });
  res.json({ success: true, message: 'Sucursal actualizada' });
});

export const remove = asyncHandler(async (req, res) => {
  const b = await fetchScoped(req, req.params.id, true);
  await pool.execute("UPDATE branches SET status='inactive' WHERE id=:id", { id: b.id });
  await writeLog({ ...reqMeta(req), action: 'deactivate', module: 'branches', recordId: b.id });
  res.json({ success: true, message: 'Sucursal desactivada' });
});

export const branchStock = asyncHandler(async (req, res) => {
  const b = await fetchScoped(req, req.params.id);
  const [rows] = await pool.execute(
    `SELECT s.id, s.quantity, i.id AS item_id, i.name, i.unit, i.minimum_stock,
            c.name AS category
     FROM stock s JOIN items i ON i.id = s.item_id
     LEFT JOIN item_categories c ON c.id = i.category_id
     WHERE s.branch_id = :id ORDER BY i.name`,
    { id: b.id }
  );
  res.json({ success: true, data: rows });
});

export const assignEmployee = asyncHandler(async (req, res) => {
  const b = await fetchScoped(req, req.params.id, true);
  const { userId } = req.body;
  const [u] = await pool.execute('SELECT id, administrator_id, role FROM users WHERE id=:id', { id: userId });
  if (!u[0] || u[0].role !== ROLES.EMPLOYEE) throw ApiError.badRequest('El usuario debe ser un empleado');
  if (req.user.role === ROLES.ADMIN && u[0].administrator_id !== req.user.id)
    throw ApiError.forbidden('El empleado no pertenece a su panel');

  await pool.execute(
    'INSERT IGNORE INTO employee_branches (user_id, branch_id) VALUES (:u,:b)',
    { u: userId, b: b.id }
  );
  await writeLog({ ...reqMeta(req), action: 'assign_employee', module: 'branches', recordId: b.id, newValue: { userId } });
  res.json({ success: true, message: 'Empleado asignado' });
});

export const unassignEmployee = asyncHandler(async (req, res) => {
  const b = await fetchScoped(req, req.params.id, true);
  await pool.execute('DELETE FROM employee_branches WHERE branch_id=:b AND user_id=:u', {
    b: b.id,
    u: req.params.userId,
  });
  await writeLog({ ...reqMeta(req), action: 'unassign_employee', module: 'branches', recordId: b.id });
  res.json({ success: true, message: 'Empleado desasignado' });
});
