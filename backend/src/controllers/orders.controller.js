import pool, { withTransaction } from '../config/db.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { ROLES } from '../middlewares/authorize.js';
import { writeLog, reqMeta } from '../utils/audit.js';
import { getPagination, buildMeta } from '../utils/pagination.js';
import { applyStockDelta, recordMovement } from '../services/stock.service.js';

const STATUS = ['pending', 'accepted', 'rejected', 'preparing', 'sent', 'delivered', 'cancelled', 'partial'];

// Transiciones permitidas para el proveedor.
const PROVIDER_TRANSITIONS = {
  pending: ['accepted', 'rejected'],
  accepted: ['preparing', 'sent', 'delivered', 'partial'],
  preparing: ['sent', 'delivered', 'partial'],
  sent: ['delivered', 'partial'],
};

function scopeWhere(req, params) {
  if (req.user.role === ROLES.ADMIN) {
    params.adminId = req.user.id;
    return 'o.administrator_id = :adminId';
  }
  if (req.user.role === ROLES.PROVIDER) {
    params.provId = req.user.id;
    return 'o.provider_id = :provId';
  }
  return '1=1';
}

export const list = asyncHandler(async (req, res) => {
  const { page, limit, offset } = getPagination(req.query);
  const params = { limit, offset };
  const where = [scopeWhere(req, params)];
  if (req.query.status) {
    where.push('o.status = :status');
    params.status = req.query.status;
  }
  const whereSql = `WHERE ${where.join(' AND ')}`;

  const [rows] = await pool.execute(
    `SELECT o.*,
            CONCAT(a.first_name,' ',a.last_name) AS admin_name,
            CONCAT(p.first_name,' ',p.last_name) AS provider_name,
            (SELECT COUNT(*) FROM order_details d WHERE d.order_id=o.id) AS items_count
     FROM orders o
     JOIN users a ON a.id = o.administrator_id
     JOIN users p ON p.id = o.provider_id
     ${whereSql}
     ORDER BY o.created_at DESC LIMIT ${limit} OFFSET ${offset}`,
    params
  );
  const [[{ total }]] = await pool.execute(`SELECT COUNT(*) AS total FROM orders o ${whereSql}`, params);
  res.json({ success: true, data: rows, meta: buildMeta(page, limit, total) });
});

async function fetchOrderScoped(req, id) {
  const [rows] = await pool.execute('SELECT * FROM orders WHERE id=:id', { id });
  const order = rows[0];
  if (!order) throw ApiError.notFound('Pedido no encontrado');
  if (req.user.role === ROLES.ADMIN && order.administrator_id !== req.user.id)
    throw ApiError.forbidden('Sin acceso a este pedido');
  if (req.user.role === ROLES.PROVIDER && order.provider_id !== req.user.id)
    throw ApiError.forbidden('Sin acceso a este pedido');
  return order;
}

export const getOne = asyncHandler(async (req, res) => {
  const order = await fetchOrderScoped(req, req.params.id);
  const [details] = await pool.execute(
    `SELECT d.*, i.name AS item_name, i.unit, b.name AS destination_branch
     FROM order_details d
     JOIN items i ON i.id = d.item_id
     LEFT JOIN branches b ON b.id = d.destination_branch_id
     WHERE d.order_id = :id`,
    { id: order.id }
  );
  const [history] = await pool.execute(
    `SELECT h.*, CONCAT(u.first_name,' ',u.last_name) AS user_name
     FROM order_status_history h LEFT JOIN users u ON u.id=h.changed_by
     WHERE h.order_id=:id ORDER BY h.created_at`,
    { id: order.id }
  );
  const [[admin]] = await pool.execute("SELECT CONCAT(first_name,' ',last_name) AS name FROM users WHERE id=:id", { id: order.administrator_id });
  const [[provider]] = await pool.execute("SELECT CONCAT(first_name,' ',last_name) AS name FROM users WHERE id=:id", { id: order.provider_id });

  res.json({ success: true, data: { ...order, adminName: admin?.name, providerName: provider?.name, details, history } });
});

export const create = asyncHandler(async (req, res) => {
  const { providerId, observations, items } = req.body;
  if (!Array.isArray(items) || !items.length) throw ApiError.badRequest('Debe incluir al menos un insumo');

  const [prov] = await pool.execute("SELECT id FROM users WHERE id=:id AND role='provider' AND status='active'", { id: providerId });
  if (!prov[0]) throw ApiError.badRequest('Proveedor invalido');

  const orderId = await withTransaction(async (conn) => {
    const [r] = await conn.execute(
      `INSERT INTO orders (administrator_id, provider_id, status, admin_observations, created_by)
       VALUES (:a,:p,'pending',:obs,:by)`,
      { a: req.user.id, p: providerId, obs: observations || null, by: req.user.id }
    );
    for (const it of items) {
      if (!it.itemId || !it.requestedQuantity || it.requestedQuantity <= 0)
        throw ApiError.badRequest('Cada item requiere itemId y cantidad > 0');
      // Validar que la sucursal destino, si se indica, pertenezca al admin.
      if (it.destinationBranchId) {
        const [b] = await conn.execute('SELECT administrator_id FROM branches WHERE id=:id', { id: it.destinationBranchId });
        if (!b[0] || b[0].administrator_id !== req.user.id)
          throw ApiError.badRequest('Sucursal destino invalida');
      }
      await conn.execute(
        `INSERT INTO order_details (order_id, item_id, destination_branch_id, requested_quantity, observations)
         VALUES (:o,:i,:b,:q,:obs)`,
        { o: r.insertId, i: it.itemId, b: it.destinationBranchId || null, q: it.requestedQuantity, obs: it.observations || null }
      );
    }
    await conn.execute(
      'INSERT INTO order_status_history (order_id, status, changed_by, observations) VALUES (:o,:s,:by,:obs)',
      { o: r.insertId, s: 'pending', by: req.user.id, obs: 'Pedido creado' }
    );
    return r.insertId;
  });

  await writeLog({ ...reqMeta(req), action: 'create', module: 'orders', recordId: orderId, newValue: { providerId } });
  res.status(201).json({ success: true, data: { id: orderId } });
});

export const cancel = asyncHandler(async (req, res) => {
  const order = await fetchOrderScoped(req, req.params.id);
  if (req.user.role === ROLES.PROVIDER) throw ApiError.forbidden('El proveedor no puede cancelar');
  if (!['pending'].includes(order.status))
    throw ApiError.badRequest('Solo se puede cancelar un pedido pendiente');

  await withTransaction(async (conn) => {
    await conn.execute("UPDATE orders SET status='cancelled' WHERE id=:id", { id: order.id });
    await conn.execute(
      'INSERT INTO order_status_history (order_id, status, changed_by, observations) VALUES (:o,:s,:by,:obs)',
      { o: order.id, s: 'cancelled', by: req.user.id, obs: req.body.observations || 'Cancelado por administrador' }
    );
  });
  await writeLog({ ...reqMeta(req), action: 'cancel', module: 'orders', recordId: order.id });
  res.json({ success: true, message: 'Pedido cancelado' });
});

export const updateStatus = asyncHandler(async (req, res) => {
  const order = await fetchOrderScoped(req, req.params.id);
  const { status, observations, items } = req.body;
  if (!STATUS.includes(status)) throw ApiError.badRequest('Estado invalido');

  // Solo el proveedor (o sysadmin) cambia el estado operativo.
  if (req.user.role === ROLES.ADMIN) throw ApiError.forbidden('El administrador no actualiza el estado');

  if (req.user.role === ROLES.PROVIDER) {
    const allowed = PROVIDER_TRANSITIONS[order.status] || [];
    if (!allowed.includes(status))
      throw ApiError.badRequest(`Transicion no permitida de "${order.status}" a "${status}"`);
  }

  const deliversStock = status === 'delivered' || status === 'partial';
  const alreadyDelivered = order.status === 'delivered' || order.status === 'partial';

  await withTransaction(async (conn) => {
    // Actualiza cantidades aprobadas/entregadas si se enviaron.
    if (Array.isArray(items)) {
      for (const it of items) {
        await conn.execute(
          `UPDATE order_details SET approved_quantity = :aq, delivered_quantity = :dq
           WHERE id = :id AND order_id = :oid`,
          { aq: it.approvedQuantity ?? null, dq: it.deliveredQuantity ?? null, id: it.id, oid: order.id }
        );
      }
    }

    // Al entregar, mueve stock: baja del proveedor, alta del administrador.
    if (deliversStock && !alreadyDelivered) {
      const [details] = await conn.execute('SELECT * FROM order_details WHERE order_id=:o', { o: order.id });
      for (const d of details) {
        const qty = Number(d.delivered_quantity ?? d.approved_quantity ?? d.requested_quantity);
        if (!qty || qty <= 0) continue;

        // Egreso del stock del proveedor (si existe registro).
        await applyStockDeltaSafe(conn, { itemId: d.item_id, providerId: order.provider_id, delta: -qty });
        await recordMovement(conn, {
          itemId: d.item_id, type: 'order_sent', quantity: qty,
          providerId: order.provider_id, orderId: order.id, reason: 'Pedido enviado', createdBy: req.user.id,
        });

        // Ingreso al administrador en la sucursal destino.
        if (d.destination_branch_id) {
          await applyStockDelta(conn, { itemId: d.item_id, branchId: d.destination_branch_id, delta: qty });
          await recordMovement(conn, {
            itemId: d.item_id, type: 'order_received', quantity: qty,
            destinationBranchId: d.destination_branch_id, orderId: order.id,
            reason: 'Pedido recibido', createdBy: req.user.id,
          });
        }
      }
    }

    await conn.execute(
      'UPDATE orders SET status=:s, provider_observations = COALESCE(:obs, provider_observations) WHERE id=:id',
      { s: status, obs: observations || null, id: order.id }
    );
    await conn.execute(
      'INSERT INTO order_status_history (order_id, status, changed_by, observations) VALUES (:o,:s,:by,:obs)',
      { o: order.id, s: status, by: req.user.id, obs: observations || null }
    );
  });

  await writeLog({ ...reqMeta(req), action: 'update_status', module: 'orders', recordId: order.id, oldValue: { status: order.status }, newValue: { status } });
  res.json({ success: true, message: 'Estado actualizado' });
});

// Variante que no falla si el proveedor no tenia registro de stock (lo crea en 0 y permite negativos controlados).
async function applyStockDeltaSafe(conn, { itemId, providerId, delta }) {
  const [rows] = await conn.query(
    'SELECT id, quantity FROM stock WHERE item_id=? AND provider_id=? FOR UPDATE',
    [itemId, providerId]
  );
  if (rows[0]) {
    const next = Math.max(0, Number(rows[0].quantity) + Number(delta));
    await conn.execute('UPDATE stock SET quantity=:q WHERE id=:id', { q: next, id: rows[0].id });
  } else {
    await conn.execute(
      'INSERT INTO stock (item_id, provider_id, quantity) VALUES (:i,:p,:q)',
      { i: itemId, p: providerId, q: Math.max(0, Number(delta)) }
    );
  }
}

export const history = asyncHandler(async (req, res) => {
  const order = await fetchOrderScoped(req, req.params.id);
  const [rows] = await pool.execute(
    `SELECT h.*, CONCAT(u.first_name,' ',u.last_name) AS user_name
     FROM order_status_history h LEFT JOIN users u ON u.id=h.changed_by
     WHERE h.order_id=:id ORDER BY h.created_at`,
    { id: order.id }
  );
  res.json({ success: true, data: rows });
});
