import pool, { withTransaction } from '../config/db.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { ROLES } from '../middlewares/authorize.js';
import { writeLog, reqMeta } from '../utils/audit.js';

// --- Vistas para administradores: catalogo de proveedores ---

export const listProviders = asyncHandler(async (req, res) => {
  const params = {};
  let where = "u.role = 'provider' AND u.status = 'active'";
  if (req.query.search) {
    where += ' AND (u.first_name LIKE :s OR u.last_name LIKE :s OR u.email LIKE :s)';
    params.s = `%${req.query.search}%`;
  }
  const [rows] = await pool.execute(
    `SELECT u.id, u.first_name, u.last_name, u.email, u.phone,
            (SELECT COUNT(*) FROM items i WHERE i.owner_type='provider' AND i.owner_id=u.id AND i.status='active') AS items_count
     FROM users u WHERE ${where} ORDER BY u.first_name`,
    params
  );
  res.json({ success: true, data: rows });
});

export const getProvider = asyncHandler(async (req, res) => {
  const [rows] = await pool.execute(
    "SELECT id, first_name, last_name, email, phone FROM users WHERE id=:id AND role='provider'",
    { id: req.params.id }
  );
  if (!rows[0]) throw ApiError.notFound('Proveedor no encontrado');
  res.json({ success: true, data: rows[0] });
});

// Catalogo de items de un proveedor con su stock disponible.
export const providerItems = asyncHandler(async (req, res) => {
  const [rows] = await pool.execute(
    `SELECT i.id, i.name, i.description, i.unit, i.minimum_stock, i.condition_state,
            c.name AS category,
            COALESCE((SELECT quantity FROM stock s WHERE s.item_id=i.id AND s.provider_id=:pid),0) AS available
     FROM items i LEFT JOIN item_categories c ON c.id=i.category_id
     WHERE i.owner_type='provider' AND i.owner_id=:pid AND i.status='active'
     ORDER BY i.name`,
    { pid: req.params.id }
  );
  res.json({ success: true, data: rows });
});

// --- Gestión del proveedor sobre su propio catalogo ---

export const myItems = asyncHandler(async (req, res) => {
  const [rows] = await pool.execute(
    `SELECT i.*, c.name AS category,
            COALESCE((SELECT quantity FROM stock s WHERE s.item_id=i.id AND s.provider_id=:pid),0) AS available
     FROM items i LEFT JOIN item_categories c ON c.id=i.category_id
     WHERE i.owner_type='provider' AND i.owner_id=:pid
     ORDER BY i.name`,
    { pid: req.user.id }
  );
  res.json({ success: true, data: rows });
});

export const createItem = asyncHandler(async (req, res) => {
  const { name, description, unit, minimumStock, categoryId, quantity } = req.body;
  const id = await withTransaction(async (conn) => {
    const [r] = await conn.execute(
      `INSERT INTO items (owner_type, owner_id, category_id, name, description, unit, minimum_stock, created_by)
       VALUES ('provider', :pid, :cat, :n, :d, :u, :min, :pid)`,
      { pid: req.user.id, cat: categoryId || null, n: name, d: description || null, u: unit || 'unidad', min: minimumStock || 0 }
    );
    await conn.execute(
      'INSERT INTO stock (item_id, provider_id, quantity) VALUES (:i,:p,:q)',
      { i: r.insertId, p: req.user.id, q: quantity || 0 }
    );
    return r.insertId;
  });
  await writeLog({ ...reqMeta(req), action: 'create', module: 'provider_items', recordId: id, newValue: { name } });
  res.status(201).json({ success: true, data: { id } });
});

async function fetchMyItem(req, id) {
  const [rows] = await pool.execute(
    "SELECT * FROM items WHERE id=:id AND owner_type='provider' AND owner_id=:pid",
    { id, pid: req.user.id }
  );
  if (!rows[0]) throw ApiError.notFound('Insumo no encontrado o no le pertenece');
  return rows[0];
}

export const updateItem = asyncHandler(async (req, res) => {
  const item = await fetchMyItem(req, req.params.id);
  const { name, description, unit, minimumStock, categoryId, status, quantity } = req.body;
  await withTransaction(async (conn) => {
    await conn.execute(
      `UPDATE items SET name=:n, description=:d, unit=:u, minimum_stock=:min, category_id=:cat, status=:st WHERE id=:id`,
      {
        n: name ?? item.name, d: description ?? item.description, u: unit ?? item.unit,
        min: minimumStock ?? item.minimum_stock, cat: categoryId ?? item.category_id,
        st: status ?? item.status, id: item.id,
      }
    );
    if (quantity !== undefined) {
      await conn.execute(
        `INSERT INTO stock (item_id, provider_id, quantity) VALUES (:i,:p,:q)
         ON DUPLICATE KEY UPDATE quantity=:q`,
        { i: item.id, p: req.user.id, q: quantity }
      );
    }
  });
  await writeLog({ ...reqMeta(req), action: 'update', module: 'provider_items', recordId: item.id });
  res.json({ success: true, message: 'Insumo actualizado' });
});

export const deleteItem = asyncHandler(async (req, res) => {
  const item = await fetchMyItem(req, req.params.id);
  await pool.execute("UPDATE items SET status='inactive' WHERE id=:id", { id: item.id });
  await writeLog({ ...reqMeta(req), action: 'deactivate', module: 'provider_items', recordId: item.id });
  res.json({ success: true, message: 'Insumo desactivado' });
});
