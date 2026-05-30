import pool from '../config/db.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { ROLES } from '../middlewares/authorize.js';
import { writeLog, reqMeta } from '../utils/audit.js';

function ownerAdminId(req) {
  // sysadmin crea categorias globales (NULL); admin crea propias.
  return req.user.role === ROLES.ADMIN ? req.user.id : null;
}

export const list = asyncHandler(async (req, res) => {
  const params = {};
  let where = '1=1';
  if (req.user.role === ROLES.ADMIN) {
    where = '(administrator_id = :uid OR administrator_id IS NULL)';
    params.uid = req.user.id;
  }
  const [rows] = await pool.execute(
    `SELECT * FROM item_categories WHERE ${where} ORDER BY name`,
    params
  );
  res.json({ success: true, data: rows });
});

export const create = asyncHandler(async (req, res) => {
  const { name, description } = req.body;
  const [r] = await pool.execute(
    'INSERT INTO item_categories (administrator_id, name, description) VALUES (:a,:n,:d)',
    { a: ownerAdminId(req), n: name, d: description || null }
  );
  await writeLog({ ...reqMeta(req), action: 'create', module: 'categories', recordId: r.insertId, newValue: { name } });
  res.status(201).json({ success: true, data: { id: r.insertId, name, description } });
});

async function fetchScoped(req, id) {
  const [rows] = await pool.execute('SELECT * FROM item_categories WHERE id=:id', { id });
  const cat = rows[0];
  if (!cat) throw ApiError.notFound('Categoria no encontrada');
  if (req.user.role === ROLES.ADMIN && cat.administrator_id && cat.administrator_id !== req.user.id) {
    throw ApiError.forbidden('No puede modificar esta categoria');
  }
  return cat;
}

export const update = asyncHandler(async (req, res) => {
  const cat = await fetchScoped(req, req.params.id);
  const { name, description, status } = req.body;
  await pool.execute(
    'UPDATE item_categories SET name=:n, description=:d, status=:s WHERE id=:id',
    { n: name ?? cat.name, d: description ?? cat.description, s: status ?? cat.status, id: cat.id }
  );
  await writeLog({ ...reqMeta(req), action: 'update', module: 'categories', recordId: cat.id });
  res.json({ success: true, message: 'Categoria actualizada' });
});

export const remove = asyncHandler(async (req, res) => {
  const cat = await fetchScoped(req, req.params.id);
  await pool.execute("UPDATE item_categories SET status='inactive' WHERE id=:id", { id: cat.id });
  await writeLog({ ...reqMeta(req), action: 'deactivate', module: 'categories', recordId: cat.id });
  res.json({ success: true, message: 'Categoria desactivada' });
});
