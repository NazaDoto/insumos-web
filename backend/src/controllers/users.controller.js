import pool from '../config/db.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { hashPassword } from '../utils/password.js';
import { ROLES } from '../middlewares/authorize.js';
import { writeLog, reqMeta } from '../utils/audit.js';
import { getPagination, buildMeta } from '../utils/pagination.js';

function mapUser(u) {
  return {
    id: u.id,
    firstName: u.first_name,
    lastName: u.last_name,
    email: u.email,
    username: u.username,
    role: u.role,
    status: u.status,
    phone: u.phone,
    administratorId: u.administrator_id,
    providerId: u.provider_id,
    adminName: u.admin_name || null,
    createdAt: u.created_at,
    updatedAt: u.updated_at,
  };
}

export const list = asyncHandler(async (req, res) => {
  const { page, limit, offset } = getPagination(req.query);
  const { search = '', role = '', status = '' } = req.query;

  const where = [];
  const params = { limit, offset };

  // Scope por rol: el admin solo ve sus empleados (y a si mismo).
  if (req.user.role === ROLES.ADMIN) {
    where.push('(u.administrator_id = :uid OR u.id = :uid)');
    params.uid = req.user.id;
  }

  if (search) {
    where.push('(u.first_name LIKE :s OR u.last_name LIKE :s OR u.email LIKE :s OR u.username LIKE :s)');
    params.s = `%${search}%`;
  }
  if (role) {
    where.push('u.role = :role');
    params.role = role;
  }
  if (status) {
    where.push('u.status = :status');
    params.status = status;
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const [rows] = await pool.execute(
    `SELECT u.*, CONCAT(a.first_name,' ',a.last_name) AS admin_name
     FROM users u
     LEFT JOIN users a ON a.id = u.administrator_id
     ${whereSql}
     ORDER BY u.created_at DESC
     LIMIT :limit OFFSET :offset`,
    params
  );
  const [[{ total }]] = await pool.execute(
    `SELECT COUNT(*) AS total FROM users u ${whereSql}`,
    params
  );

  res.json({ success: true, data: rows.map(mapUser), meta: buildMeta(page, limit, total) });
});

async function fetchUserScoped(req, id) {
  const [rows] = await pool.execute(
    `SELECT u.*, CONCAT(a.first_name,' ',a.last_name) AS admin_name
     FROM users u LEFT JOIN users a ON a.id = u.administrator_id
     WHERE u.id = :id`,
    { id }
  );
  const user = rows[0];
  if (!user) throw ApiError.notFound('Usuario no encontrado');
  if (req.user.role === ROLES.ADMIN && user.administrator_id !== req.user.id && user.id !== req.user.id) {
    throw ApiError.forbidden('No puede acceder a este usuario');
  }
  return user;
}

export const getOne = asyncHandler(async (req, res) => {
  const user = await fetchUserScoped(req, req.params.id);
  res.json({ success: true, data: mapUser(user) });
});

export const create = asyncHandler(async (req, res) => {
  const { firstName, lastName, email, username, password, role, phone } = req.body;
  let administratorId = req.body.administratorId ?? null;
  let providerId = req.body.providerId ?? null;

  // Un admin solo puede crear empleados vinculados a si mismo.
  if (req.user.role === ROLES.ADMIN) {
    if (role !== ROLES.EMPLOYEE) {
      throw ApiError.forbidden('Un administrador solo puede crear empleados');
    }
    administratorId = req.user.id;
  } else {
    // sysadmin: empleado debe tener administrator_id.
    if (role === ROLES.EMPLOYEE && !administratorId) {
      throw ApiError.badRequest('Un empleado debe estar vinculado a un administrador');
    }
  }

  const hash = await hashPassword(password);
  const [result] = await pool.execute(
    `INSERT INTO users (first_name,last_name,email,username,password_hash,role,phone,administrator_id,provider_id,status)
     VALUES (:firstName,:lastName,:email,:username,:hash,:role,:phone,:administratorId,:providerId,'active')`,
    { firstName, lastName, email, username, hash, role, phone: phone || null, administratorId, providerId }
  );

  await writeLog({ ...reqMeta(req), action: 'create', module: 'users', recordId: result.insertId, newValue: { email, role } });
  const user = await fetchUserScoped(req, result.insertId);
  res.status(201).json({ success: true, data: mapUser(user) });
});

export const update = asyncHandler(async (req, res) => {
  const existing = await fetchUserScoped(req, req.params.id);
  const { firstName, lastName, email, username, phone } = req.body;

  // El rol no puede modificarse aqui (proteccion contra escalada de privilegios),
  // salvo sysadmin explicitamente.
  let role = existing.role;
  if (req.user.role === ROLES.SYSADMIN && req.body.role) role = req.body.role;

  await pool.execute(
    `UPDATE users SET first_name=:firstName, last_name=:lastName, email=:email,
       username=:username, phone=:phone, role=:role WHERE id=:id`,
    {
      firstName: firstName ?? existing.first_name,
      lastName: lastName ?? existing.last_name,
      email: email ?? existing.email,
      username: username ?? existing.username,
      phone: phone ?? existing.phone,
      role,
      id: existing.id,
    }
  );

  if (req.body.password) {
    const hash = await hashPassword(req.body.password);
    await pool.execute('UPDATE users SET password_hash=:hash WHERE id=:id', { hash, id: existing.id });
  }

  await writeLog({ ...reqMeta(req), action: 'update', module: 'users', recordId: existing.id, oldValue: { email: existing.email }, newValue: { email } });
  const user = await fetchUserScoped(req, existing.id);
  res.json({ success: true, data: mapUser(user) });
});

export const setStatus = asyncHandler(async (req, res) => {
  const existing = await fetchUserScoped(req, req.params.id);
  const { status } = req.body;
  if (existing.id === req.user.id) throw ApiError.badRequest('No puede cambiar su propio estado');

  await pool.execute('UPDATE users SET status=:status WHERE id=:id', { status, id: existing.id });
  await writeLog({ ...reqMeta(req), action: 'set_status', module: 'users', recordId: existing.id, oldValue: { status: existing.status }, newValue: { status } });
  res.json({ success: true, message: 'Estado actualizado' });
});

export const remove = asyncHandler(async (req, res) => {
  const existing = await fetchUserScoped(req, req.params.id);
  if (existing.id === req.user.id) throw ApiError.badRequest('No puede eliminar su propio usuario');
  // Se recomienda desactivar; aqui desactivamos para preservar historial.
  await pool.execute("UPDATE users SET status='inactive' WHERE id=:id", { id: existing.id });
  await writeLog({ ...reqMeta(req), action: 'deactivate', module: 'users', recordId: existing.id });
  res.json({ success: true, message: 'Usuario desactivado' });
});
