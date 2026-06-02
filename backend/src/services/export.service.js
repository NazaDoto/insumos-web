import pool from '../config/db.js';
import { ROLES } from '../middlewares/authorize.js';
import { ownerWhere as itemsOwnerWhere } from '../controllers/items.controller.js';

const MAX_ROWS = 10000;

const ROLE_ES = {
  sysadmin: 'Administrador del sistema',
  admin: 'Administrador',
  provider: 'Proveedor',
  employee: 'Empleado',
};

const STATUS_ES = {
  active: 'Activo',
  inactive: 'Inactivo',
  pending: 'Pendiente',
  accepted: 'Aceptado',
  rejected: 'Rechazado',
  preparing: 'En preparación',
  sent: 'Enviado',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
  partial: 'Entrega parcial',
  available: 'Disponible',
  in_use: 'En uso',
  repair: 'En reparación',
  damaged: 'Dañado',
  retired: 'Dado de baja',
  reserved: 'Reservado',
  lost: 'Perdido',
};

const MOVEMENT_ES = {
  income: 'Ingreso',
  outcome: 'Egreso',
  transfer: 'Transferencia',
  usage: 'Uso',
  adjustment: 'Ajuste',
  order_received: 'Recepción pedido',
  order_sent: 'Envío pedido',
  return: 'Devolución',
  correction: 'Corrección',
};

function fmtDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleString('es-AR');
}

function label(map, key) {
  return map[key] || key || '';
}

export async function exportUsers(req) {
  const { search = '', role = '', status = '' } = req.query;
  const where = [];
  const params = {};
  if (req.user.role === ROLES.ADMIN) {
    where.push('(u.administrator_id = :uid OR u.id = :uid)');
    params.uid = req.user.id;
  }
  if (search) {
    where.push('(u.first_name LIKE :s OR u.last_name LIKE :s OR u.email LIKE :s OR u.username LIKE :s)');
    params.s = `%${search}%`;
  }
  if (role) { where.push('u.role = :role'); params.role = role; }
  if (status) { where.push('u.status = :status'); params.status = status; }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const [rows] = await pool.execute(
    `SELECT u.*, CONCAT(a.first_name,' ',a.last_name) AS admin_name
     FROM users u LEFT JOIN users a ON a.id = u.administrator_id
     ${whereSql} ORDER BY u.last_name, u.first_name LIMIT ${MAX_ROWS}`,
    params
  );
  return rows.map((u) => ({
    ID: u.id,
    Nombre: `${u.first_name} ${u.last_name}`.trim(),
    Email: u.email,
    Usuario: u.username,
    Rol: label(ROLE_ES, u.role),
    Estado: label(STATUS_ES, u.status),
    Teléfono: u.phone || '',
    Administrador: u.admin_name || '',
  }));
}

export async function exportItems(req) {
  const { search = '', categoryId = '', status = '', lowStock = '' } = req.query;
  const params = {};
  const where = [itemsOwnerWhere(req, params)];
  if (search) {
    where.push('(i.name LIKE :s OR i.description LIKE :s)');
    params.s = `%${search}%`;
  }
  if (categoryId) { where.push('i.category_id = :cat'); params.cat = categoryId; }
  if (status) { where.push('i.status = :st'); params.st = status; }
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
     FROM items i LEFT JOIN item_categories c ON c.id = i.category_id
     WHERE ${whereSql}
     ORDER BY i.name LIMIT ${MAX_ROWS}`,
    params
  );
  return rows.map((i) => ({
    'ID interno': i.id,
    'ID externo': i.external_ref_id || '',
    Insumo: i.name,
    Categoría: i.category_name || '',
    'Sin asignar': Number(i.unassigned_stock),
    'Asignado (sucursales)': Number(i.assigned_stock),
    'Stock total': Number(i.total_stock),
    Unidad: i.unit,
    'Stock mínimo': Number(i.minimum_stock),
    Estado: label(STATUS_ES, i.status),
    Condición: label(STATUS_ES, i.condition_state),
    Descripción: i.description || '',
  }));
}

export async function exportCategories(req) {
  const params = {};
  let where = '1=1';
  if (req.user.role !== ROLES.SYSADMIN) {
    where = '(administrator_id = :uid OR administrator_id IS NULL)';
    params.uid = req.user.id;
  }
  const [rows] = await pool.execute(
    `SELECT * FROM item_categories WHERE ${where} ORDER BY name LIMIT ${MAX_ROWS}`,
    params
  );
  return rows.map((c) => ({
    ID: c.id,
    Nombre: c.name,
    Descripción: c.description || '',
    Estado: label(STATUS_ES, c.status),
  }));
}

export async function exportBranches(req) {
  const params = {};
  let where = '1=1';
  if (req.user.role === ROLES.ADMIN) {
    where = 'b.administrator_id = :uid';
    params.uid = req.user.id;
  } else if (req.user.role === ROLES.EMPLOYEE) {
    where = 'b.id IN (SELECT branch_id FROM employee_branches WHERE user_id = :emp)';
    params.emp = req.user.id;
  }
  const [rows] = await pool.execute(
    `SELECT b.*, CONCAT(u.first_name,' ',u.last_name) AS responsible_name
     FROM branches b LEFT JOIN users u ON u.id = b.responsible_user_id
     WHERE ${where} ORDER BY b.name LIMIT ${MAX_ROWS}`,
    params
  );
  return rows.map((b) => ({
    ID: b.id,
    Nombre: b.name,
    Dirección: b.address || '',
    Descripción: b.description || '',
    Responsable: b.responsible_name || '',
    Estado: label(STATUS_ES, b.status),
  }));
}

export async function exportStock(req) {
  const params = {};
  const where = [];
  if (req.user.role === ROLES.ADMIN) {
    params.adminId = req.user.id;
    where.push('b.administrator_id = :adminId');
  } else if (req.user.role === ROLES.EMPLOYEE) {
    params.emp = req.user.id;
    where.push('s.branch_id IN (SELECT branch_id FROM employee_branches WHERE user_id = :emp)');
  }
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
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const [rows] = await pool.execute(
    `SELECT i.name AS item_name, i.unit, i.minimum_stock, b.name AS branch_name, s.quantity,
            (s.quantity <= i.minimum_stock) AS low_stock
     FROM stock s JOIN items i ON i.id = s.item_id
     LEFT JOIN branches b ON b.id = s.branch_id
     ${whereSql} ORDER BY i.name LIMIT ${MAX_ROWS}`,
    params
  );
  return rows.map((r) => ({
    Insumo: r.item_name,
    Sucursal: r.branch_name || 'Sin asignar',
    Cantidad: Number(r.quantity),
    Unidad: r.unit,
    'Stock mínimo': Number(r.minimum_stock),
    'Bajo stock': r.low_stock ? 'Sí' : 'No',
  }));
}

export async function exportMovements(req) {
  const params = {};
  const where = [];
  if (req.user.role === ROLES.ADMIN) {
    where.push(`m.item_id IN (SELECT id FROM items WHERE owner_type='administrator' AND owner_id = :adminId)`);
    params.adminId = req.user.id;
  } else if (req.user.role === ROLES.EMPLOYEE) {
    where.push('m.created_by = :emp');
    params.emp = req.user.id;
  }
  if (req.query.type) { where.push('m.movement_type = :type'); params.type = req.query.type; }
  if (req.query.from) { where.push('m.created_at >= :from'); params.from = req.query.from; }
  if (req.query.to) { where.push('m.created_at <= :to'); params.to = req.query.to; }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const [rows] = await pool.execute(
    `SELECT m.*, i.name AS item_name, CONCAT(u.first_name,' ',u.last_name) AS user_name,
            COALESCE(ob.name, IF(m.origin_branch_id IS NULL AND m.movement_type IN ('income','outcome','transfer','adjustment'), 'Sin asignar', NULL)) AS origin_branch,
            COALESCE(db.name, IF(m.destination_branch_id IS NULL AND m.movement_type IN ('income','outcome','transfer','adjustment'), 'Sin asignar', NULL)) AS destination_branch
     FROM stock_movements m JOIN items i ON i.id = m.item_id
     LEFT JOIN users u ON u.id = m.created_by
     LEFT JOIN branches ob ON ob.id = m.origin_branch_id
     LEFT JOIN branches db ON db.id = m.destination_branch_id
     ${whereSql} ORDER BY m.created_at DESC LIMIT ${MAX_ROWS}`,
    params
  );
  return rows.map((m) => ({
    Fecha: fmtDate(m.created_at),
    Insumo: m.item_name,
    Tipo: label(MOVEMENT_ES, m.movement_type),
    Cantidad: Number(m.quantity),
    Origen: m.origin_branch || '',
    Destino: m.destination_branch || '',
    Motivo: m.reason || '',
    Usuario: m.user_name || '',
  }));
}

export async function exportOrders(req) {
  const params = {};
  const where = [];
  if (req.user.role === ROLES.ADMIN) {
    where.push('o.administrator_id = :adminId');
    params.adminId = req.user.id;
  }
  if (req.user.role === ROLES.PROVIDER) {
    where.push('o.provider_id = :provId');
    params.provId = req.user.id;
  }
  if (req.query.status) {
    where.push('o.status = :status');
    params.status = req.query.status;
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const [rows] = await pool.execute(
    `SELECT o.*, CONCAT(a.first_name,' ',a.last_name) AS admin_name,
            CONCAT(p.first_name,' ',p.last_name) AS provider_name,
            (SELECT COUNT(*) FROM order_details d WHERE d.order_id=o.id) AS items_count
     FROM orders o
     JOIN users a ON a.id = o.administrator_id
     JOIN users p ON p.id = o.provider_id
     ${whereSql} ORDER BY o.created_at DESC LIMIT ${MAX_ROWS}`,
    params
  );
  return rows.map((o) => ({
    Pedido: o.id,
    Estado: label(STATUS_ES, o.status),
    Fecha: fmtDate(o.created_at),
    Administrador: o.admin_name,
    Proveedor: o.provider_name,
    'Cant. líneas': Number(o.items_count),
    'Obs. administrador': o.admin_observations || '',
    'Obs. proveedor': o.provider_observations || '',
  }));
}

export async function exportUsage(req) {
  const params = {};
  const where = [];
  if (req.user.role === ROLES.EMPLOYEE) {
    where.push('r.employee_id = :emp');
    params.emp = req.user.id;
  } else if (req.user.role === ROLES.ADMIN) {
    where.push(`r.item_id IN (SELECT id FROM items WHERE owner_type='administrator' AND owner_id = :adminId)`);
    params.adminId = req.user.id;
  }
  if (req.query.branchId) {
    where.push('r.branch_id = :branchId');
    params.branchId = req.query.branchId;
  }
  if (req.query.from) { where.push('r.created_at >= :from'); params.from = req.query.from; }
  if (req.query.to) { where.push('r.created_at <= :to'); params.to = req.query.to; }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const [rows] = await pool.execute(
    `SELECT r.*, i.name AS item_name, i.unit, b.name AS branch_name,
            CONCAT(u.first_name,' ',u.last_name) AS employee_name
     FROM usage_records r
     JOIN items i ON i.id = r.item_id
     JOIN branches b ON b.id = r.branch_id
     JOIN users u ON u.id = r.employee_id
     ${whereSql} ORDER BY r.created_at DESC LIMIT ${MAX_ROWS}`,
    params
  );
  return rows.map((r) => ({
    Fecha: fmtDate(r.created_at),
    Insumo: r.item_name,
    Sucursal: r.branch_name,
    Cantidad: Number(r.quantity),
    Unidad: r.unit,
    Empleado: r.employee_name,
    Lugar: r.used_where || '',
    Motivo: r.used_for || '',
    Observaciones: r.observations || '',
  }));
}

export async function exportLogs(req) {
  const params = {};
  const where = [];
  if (req.user.role === ROLES.ADMIN) {
    params.adminId = req.user.id;
    where.push('(l.user_id = :adminId OR l.user_id IN (SELECT id FROM users WHERE administrator_id = :adminId))');
  }
  if (req.query.module) { where.push('l.module = :module'); params.module = req.query.module; }
  if (req.query.action) { where.push('l.action = :action'); params.action = req.query.action; }
  if (req.query.userId) { where.push('l.user_id = :userId'); params.userId = req.query.userId; }
  if (req.query.from) { where.push('l.created_at >= :from'); params.from = req.query.from; }
  if (req.query.to) { where.push('l.created_at <= :to'); params.to = req.query.to; }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const [rows] = await pool.execute(
    `SELECT l.*, CONCAT(u.first_name,' ',u.last_name) AS user_name
     FROM logs l LEFT JOIN users u ON u.id = l.user_id
     ${whereSql} ORDER BY l.created_at DESC LIMIT ${MAX_ROWS}`,
    params
  );
  return rows.map((l) => ({
    Fecha: fmtDate(l.created_at),
    Usuario: l.user_name || '',
    Rol: l.user_role || '',
    Módulo: l.module,
    Acción: l.action,
    'ID registro': l.record_id || '',
    IP: l.ip_address || '',
  }));
}

export async function exportProviders(req) {
  const params = {};
  let where = "u.role = 'provider' AND u.status = 'active'";
  if (req.query.search) {
    where += ' AND (u.first_name LIKE :s OR u.last_name LIKE :s OR u.email LIKE :s)';
    params.s = `%${req.query.search}%`;
  }
  const [rows] = await pool.execute(
    `SELECT u.id, u.first_name, u.last_name, u.email, u.phone,
            (SELECT COUNT(*) FROM items i WHERE i.owner_type='provider' AND i.owner_id=u.id AND i.status='active') AS items_count
     FROM users u WHERE ${where} ORDER BY u.first_name LIMIT ${MAX_ROWS}`,
    params
  );
  return rows.map((p) => ({
    ID: p.id,
    Nombre: `${p.first_name} ${p.last_name}`.trim(),
    Email: p.email,
    Teléfono: p.phone || '',
    'Insumos activos': Number(p.items_count),
  }));
}

export async function exportProviderCatalog(req) {
  const [rows] = await pool.execute(
    `SELECT i.*, c.name AS category,
            COALESCE((SELECT quantity FROM stock s WHERE s.item_id=i.id AND s.provider_id=:pid),0) AS available
     FROM items i LEFT JOIN item_categories c ON c.id = i.category_id
     WHERE i.owner_type='provider' AND i.owner_id=:pid
     ORDER BY i.name LIMIT ${MAX_ROWS}`,
    { pid: req.user.id }
  );
  return rows.map((i) => ({
    'ID interno': i.id,
    'ID externo': i.external_ref_id || '',
    Insumo: i.name,
    Categoría: i.category || '',
    Disponible: Number(i.available),
    Unidad: i.unit,
    'Stock mínimo': Number(i.minimum_stock),
    Estado: label(STATUS_ES, i.status),
    Condición: label(STATUS_ES, i.condition_state),
    Descripción: i.description || '',
  }));
}

export async function exportCustomFields(req) {
  const params = {};
  let where = '1=1';
  if (req.user.role === ROLES.ADMIN) {
    where = '(administrator_id = :uid OR administrator_id IS NULL)';
    params.uid = req.user.id;
  }
  if (req.query.module) {
    where += ' AND module = :module';
    params.module = req.query.module;
  }
  const [rows] = await pool.execute(
    `SELECT * FROM custom_fields WHERE ${where} ORDER BY module, sort_order, id LIMIT ${MAX_ROWS}`,
    params
  );
  const ids = rows.map((r) => r.id);
  let optMap = {};
  if (ids.length) {
    const [opts] = await pool.query(
      'SELECT field_id, label, value FROM custom_field_options WHERE field_id IN (?) ORDER BY sort_order',
      [ids]
    );
    for (const o of opts) {
      (optMap[o.field_id] ||= []).push(o.label || o.value);
    }
  }
  return rows.map((f) => ({
    ID: f.id,
    Módulo: f.module,
    'Nombre técnico': f.field_name,
    Etiqueta: f.field_label,
    Tipo: f.field_type,
    Obligatorio: f.is_required ? 'Sí' : 'No',
    Activo: f.is_active ? 'Sí' : 'No',
    Opciones: (optMap[f.id] || []).join(', '),
  }));
}
