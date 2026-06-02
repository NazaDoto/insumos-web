import pool, { withTransaction } from '../config/db.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { ROLES } from '../middlewares/authorize.js';
import { writeLog, reqMeta } from '../utils/audit.js';
import { getPagination, buildMeta } from '../utils/pagination.js';
import { saveCustomValues, loadCustomValues } from '../utils/customValues.js';
import { importItemsFromExcel, buildImportTemplate } from '../services/items.import.service.js';
import { setUnassignedStockQty } from '../services/stock.service.js';

function mapItem(i) {
  return {
    id: i.id,
    externalRefId: i.external_ref_id || null,
    ownerType: i.owner_type,
    ownerId: i.owner_id,
    categoryId: i.category_id,
    category: i.category_name || null,
    name: i.name,
    description: i.description,
    unit: i.unit,
    minimumStock: i.minimum_stock,
    status: i.status,
    conditionState: i.condition_state,
    unassignedStock: i.unassigned_stock !== undefined ? Number(i.unassigned_stock || 0) : undefined,
    assignedStock: i.assigned_stock !== undefined ? Number(i.assigned_stock || 0) : undefined,
    totalStock: i.total_stock !== undefined ? Number(i.total_stock || 0) : undefined,
    createdAt: i.created_at,
    updatedAt: i.updated_at,
  };
}

// Construye el filtro de propiedad segun rol.
export function ownerWhere(req, params) {
  if (req.user.role === ROLES.SYSADMIN) return '1=1';
  if (req.user.role === ROLES.ADMIN) {
    params.oid = req.user.id;
    return "i.owner_type='administrator' AND i.owner_id = :oid";
  }
  if (req.user.role === ROLES.EMPLOYEE) {
    params.oid = req.user.administrator_id;
    params.emp = req.user.id;
    return `i.owner_type='administrator' AND i.owner_id = :oid AND i.id IN (
      SELECT s.item_id FROM stock s
      JOIN employee_branches eb ON eb.branch_id = s.branch_id
      WHERE eb.user_id = :emp)`;
  }
  if (req.user.role === ROLES.PROVIDER) {
    params.oid = req.user.id;
    return "i.owner_type='provider' AND i.owner_id = :oid";
  }
  return '1=0';
}

export const list = asyncHandler(async (req, res) => {
  const { page, limit, offset } = getPagination(req.query);
  const { search = '', categoryId = '', status = '', lowStock = '' } = req.query;
  const params = { limit, offset };

  const where = [ownerWhere(req, params)];
  if (search) {
    where.push('(i.name LIKE :s OR i.description LIKE :s)');
    params.s = `%${search}%`;
  }
  if (categoryId) {
    where.push('i.category_id = :cat');
    params.cat = categoryId;
  }
  if (status) {
    where.push('i.status = :st');
    params.st = status;
  }
  if (lowStock === 'true') {
    where.push(
      `(SELECT COALESCE(SUM(quantity), 0) FROM stock s WHERE s.item_id = i.id AND s.provider_id IS NULL) <= i.minimum_stock`
    );
  }
  const whereSql = where.join(' AND ');

  const [rows] = await pool.execute(
    `SELECT i.*, c.name AS category_name,
            COALESCE((SELECT quantity FROM stock s WHERE s.item_id = i.id AND s.branch_id IS NULL AND s.provider_id IS NULL), 0) AS unassigned_stock,
            COALESCE((SELECT SUM(quantity) FROM stock s WHERE s.item_id = i.id AND s.branch_id IS NOT NULL), 0) AS assigned_stock,
            COALESCE((SELECT SUM(quantity) FROM stock s WHERE s.item_id = i.id AND s.provider_id IS NULL), 0) AS total_stock
     FROM items i
     LEFT JOIN item_categories c ON c.id = i.category_id
     WHERE ${whereSql}
     ORDER BY i.name
     LIMIT ${limit} OFFSET ${offset}`,
    params
  );
  const [[{ total }]] = await pool.execute(
    `SELECT COUNT(*) AS total FROM items i WHERE ${whereSql}`,
    params
  );

  res.json({ success: true, data: rows.map(mapItem), meta: buildMeta(page, limit, total) });
});

async function fetchScoped(req, id, write = false) {
  const [rows] = await pool.execute(
    `SELECT i.*, c.name AS category_name,
            COALESCE((SELECT quantity FROM stock s WHERE s.item_id = i.id AND s.branch_id IS NULL AND s.provider_id IS NULL), 0) AS unassigned_stock,
            COALESCE((SELECT SUM(quantity) FROM stock s WHERE s.item_id = i.id AND s.branch_id IS NOT NULL), 0) AS assigned_stock,
            COALESCE((SELECT SUM(quantity) FROM stock s WHERE s.item_id = i.id AND s.provider_id IS NULL), 0) AS total_stock
     FROM items i LEFT JOIN item_categories c ON c.id = i.category_id WHERE i.id = :id`,
    { id }
  );
  const item = rows[0];
  if (!item) throw ApiError.notFound('Insumo no encontrado');

  if (req.user.role === ROLES.ADMIN && !(item.owner_type === 'administrator' && item.owner_id === req.user.id))
    throw ApiError.forbidden('Sin acceso a este insumo');
  if (req.user.role === ROLES.PROVIDER && !(item.owner_type === 'provider' && item.owner_id === req.user.id))
    throw ApiError.forbidden('Sin acceso a este insumo');
  if (req.user.role === ROLES.EMPLOYEE) {
    if (write) throw ApiError.forbidden('Sin permisos de escritura');
    if (!(item.owner_type === 'administrator' && item.owner_id === req.user.administrator_id))
      throw ApiError.forbidden('Sin acceso a este insumo');
  }
  return item;
}

export const getOne = asyncHandler(async (req, res) => {
  const item = await fetchScoped(req, req.params.id);
  const customValues = await loadCustomValues('items', item.id);
  const [stockRows] = await pool.execute(
    `SELECT s.branch_id, b.name AS branch_name, s.quantity
     FROM stock s LEFT JOIN branches b ON b.id = s.branch_id
     WHERE s.item_id = :id AND s.provider_id IS NULL
     ORDER BY s.branch_id IS NULL DESC, b.name`,
    { id: item.id }
  );
  res.json({ success: true, data: { ...mapItem(item), customValues, stockByBranch: stockRows } });
});

export const create = asyncHandler(async (req, res) => {
  const { name, description, unit, minimumStock, categoryId, conditionState, customValues } = req.body;

  let ownerType = 'administrator';
  let ownerId = req.user.id;
  if (req.user.role === ROLES.PROVIDER) {
    ownerType = 'provider';
    ownerId = req.user.id;
  } else if (req.user.role === ROLES.SYSADMIN) {
    ownerType = req.body.ownerType || 'administrator';
    ownerId = req.body.ownerId;
    if (!ownerId) throw ApiError.badRequest('ownerId requerido para sysadmin');
  }

  const id = await withTransaction(async (conn) => {
    const [r] = await conn.execute(
      `INSERT INTO items (owner_type, owner_id, category_id, name, description, unit, minimum_stock, condition_state, created_by)
       VALUES (:ot,:oid,:cat,:n,:d,:u,:min,:cs,:by)`,
      {
        ot: ownerType,
        oid: ownerId,
        cat: categoryId || null,
        n: name,
        d: description || null,
        u: unit || 'unidad',
        min: minimumStock || 0,
        cs: conditionState || 'available',
        by: req.user.id,
      }
    );
    await saveCustomValues('items', r.insertId, customValues, conn);
    return r.insertId;
  });

  await writeLog({ ...reqMeta(req), action: 'create', module: 'items', recordId: id, newValue: { name } });
  res.status(201).json({ success: true, data: { id } });
});

export const update = asyncHandler(async (req, res) => {
  const item = await fetchScoped(req, req.params.id, true);
  const { name, description, unit, minimumStock, categoryId, status, conditionState, customValues } = req.body;

  await withTransaction(async (conn) => {
    await conn.execute(
      `UPDATE items SET name=:n, description=:d, unit=:u, minimum_stock=:min,
         category_id=:cat, status=:st, condition_state=:cs WHERE id=:id`,
      {
        n: name ?? item.name,
        d: description ?? item.description,
        u: unit ?? item.unit,
        min: minimumStock ?? item.minimum_stock,
        cat: categoryId ?? item.category_id,
        st: status ?? item.status,
        cs: conditionState ?? item.condition_state,
        id: item.id,
      }
    );
    await saveCustomValues('items', item.id, customValues, conn);
  });

  await writeLog({ ...reqMeta(req), action: 'update', module: 'items', recordId: item.id, oldValue: { name: item.name } });
  res.json({ success: true, message: 'Insumo actualizado' });
});

export const remove = asyncHandler(async (req, res) => {
  const item = await fetchScoped(req, req.params.id, true);
  await pool.execute("UPDATE items SET status='inactive' WHERE id=:id", { id: item.id });
  await writeLog({ ...reqMeta(req), action: 'deactivate', module: 'items', recordId: item.id });
  res.json({ success: true, message: 'Insumo desactivado' });
});

export const setUnassignedStock = asyncHandler(async (req, res) => {
  const item = await fetchScoped(req, req.params.id, true);
  if (item.owner_type === 'provider') {
    throw ApiError.badRequest('Use la gestión de stock del proveedor para este insumo');
  }
  const { quantity, reason } = req.body;
  const target = Number(quantity);
  if (Number.isNaN(target) || target < 0) throw ApiError.badRequest('Cantidad inválida');

  await withTransaction(async (conn) => {
    const result = await setUnassignedStockQty(conn, {
      itemId: item.id,
      targetQty: target,
      reason: reason || 'Ajuste desde listado de insumos',
      createdBy: req.user.id,
    });
    if (!result.changed && target === 0) return;
  });

  await writeLog({
    ...reqMeta(req),
    action: 'stock_unassigned',
    module: 'items',
    recordId: item.id,
    newValue: { quantity: target },
  });
  res.json({ success: true, message: 'Stock sin asignar actualizado' });
});

export const movements = asyncHandler(async (req, res) => {
  const item = await fetchScoped(req, req.params.id);
  const [rows] = await pool.execute(
    `SELECT m.*, CONCAT(u.first_name,' ',u.last_name) AS user_name,
            COALESCE(ob.name, IF(m.origin_branch_id IS NULL AND m.movement_type IN ('income','outcome','transfer','adjustment'), 'Sin asignar', NULL)) AS origin_branch,
            COALESCE(db.name, IF(m.destination_branch_id IS NULL AND m.movement_type IN ('income','outcome','transfer','adjustment'), 'Sin asignar', NULL)) AS destination_branch
     FROM stock_movements m
     LEFT JOIN users u ON u.id = m.created_by
     LEFT JOIN branches ob ON ob.id = m.origin_branch_id
     LEFT JOIN branches db ON db.id = m.destination_branch_id
     WHERE m.item_id = :id ORDER BY m.created_at DESC LIMIT 200`,
    { id: item.id }
  );
  res.json({ success: true, data: rows });
});

export const attributes = asyncHandler(async (req, res) => {
  const item = await fetchScoped(req, req.params.id);
  const customValues = await loadCustomValues('items', item.id);
  res.json({ success: true, data: customValues });
});

export const importExcel = asyncHandler(async (req, res) => {
  if (!req.file?.buffer) throw ApiError.badRequest('Debe adjuntar un archivo Excel (.xlsx)');
  const result = await importItemsFromExcel(req, req.file.buffer);
  await writeLog({
    ...reqMeta(req),
    action: 'import',
    module: 'items',
    newValue: result.summary,
  });
  res.json({ success: true, ...result });
});

export const downloadImportTemplate = asyncHandler(async (req, res) => {
  const wb = await buildImportTemplate(req);
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
  res.setHeader('Content-Disposition', 'attachment; filename="plantilla_insumos.xlsx"');
  await wb.xlsx.write(res);
  res.end();
});
