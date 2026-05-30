import ApiError from '../utils/ApiError.js';

/**
 * Obtiene la cantidad actual de stock para item en una ubicación (oficina o proveedor).
 * Usa FOR UPDATE para bloquear la fila dentro de la transaccion.
 */
export async function getStockQty(conn, { itemId, branchId = null, providerId = null }) {
  const [rows] = await conn.query(
    `SELECT id, quantity FROM stock
     WHERE item_id = ? AND ${branchId !== null ? 'branch_id = ?' : 'branch_id IS NULL'}
       AND ${providerId !== null ? 'provider_id = ?' : 'provider_id IS NULL'}
     FOR UPDATE`,
    branchId !== null && providerId !== null
      ? [itemId, branchId, providerId]
      : branchId !== null
        ? [itemId, branchId]
        : providerId !== null
          ? [itemId, providerId]
          : [itemId]
  );
  return rows[0] || null;
}

/**
 * Aplica un delta (positivo o negativo) al stock, creando la fila si no existe.
 * Lanza error si el resultado seria negativo.
 */
export async function applyStockDelta(conn, { itemId, branchId = null, providerId = null, delta }) {
  const current = await getStockQty(conn, { itemId, branchId, providerId });
  const currentQty = current ? Number(current.quantity) : 0;
  const next = currentQty + Number(delta);
  if (next < 0) {
    throw ApiError.badRequest(
      `Stock insuficiente. Disponible: ${currentQty}, requerido: ${Math.abs(delta)}`
    );
  }
  if (current) {
    await conn.execute('UPDATE stock SET quantity = :q WHERE id = :id', { q: next, id: current.id });
  } else {
    await conn.execute(
      'INSERT INTO stock (item_id, branch_id, provider_id, quantity) VALUES (:i,:b,:p,:q)',
      { i: itemId, b: branchId, p: providerId, q: next }
    );
  }
  return next;
}

// Registra un movimiento de stock.
export async function recordMovement(conn, m) {
  await conn.execute(
    `INSERT INTO stock_movements
       (item_id, movement_type, quantity, origin_branch_id, destination_branch_id, provider_id, order_id, usage_record_id, reason, created_by)
     VALUES (:itemId,:type,:qty,:origin,:dest,:provider,:order,:usage,:reason,:by)`,
    {
      itemId: m.itemId,
      type: m.type,
      qty: m.quantity,
      origin: m.originBranchId ?? null,
      dest: m.destinationBranchId ?? null,
      provider: m.providerId ?? null,
      order: m.orderId ?? null,
      usage: m.usageRecordId ?? null,
      reason: m.reason ?? null,
      by: m.createdBy ?? null,
    }
  );
}
