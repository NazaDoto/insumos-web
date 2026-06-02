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

/** Mueve cantidad del pool sin asignar (branch_id NULL) hacia una sucursal. */
export async function assignStockToBranch(conn, { itemId, branchId, quantity, reason, createdBy }) {
  const qty = Math.abs(Number(quantity));
  await applyStockDelta(conn, { itemId, branchId: null, delta: -qty });
  await applyStockDelta(conn, { itemId, branchId, delta: qty });
  await recordMovement(conn, {
    itemId,
    type: 'income',
    quantity: qty,
    originBranchId: null,
    destinationBranchId: branchId,
    reason,
    createdBy,
  });
}

/** Devuelve cantidad de una sucursal al pool sin asignar. */
export async function unassignStockFromBranch(conn, { itemId, branchId, quantity, reason, createdBy }) {
  const qty = Math.abs(Number(quantity));
  await applyStockDelta(conn, { itemId, branchId, delta: -qty });
  await applyStockDelta(conn, { itemId, branchId: null, delta: qty });
  await recordMovement(conn, {
    itemId,
    type: 'outcome',
    quantity: qty,
    originBranchId: branchId,
    destinationBranchId: null,
    reason,
    createdBy,
  });
}

/** Ajusta el stock sin asignar a una cantidad absoluta (registra ingreso/egreso). */
export async function setUnassignedStockQty(conn, { itemId, targetQty, reason, createdBy }) {
  const current = await getStockQty(conn, { itemId, branchId: null });
  const currentQty = current ? Number(current.quantity) : 0;
  const target = Number(targetQty);
  const delta = target - currentQty;
  if (delta === 0) return { changed: false, quantity: currentQty };

  if (delta > 0) {
    await applyStockDelta(conn, { itemId, branchId: null, delta });
    await recordMovement(conn, {
      itemId,
      type: 'income',
      quantity: delta,
      destinationBranchId: null,
      reason: reason || 'Ingreso a stock sin asignar',
      createdBy,
    });
  } else {
    await applyStockDelta(conn, { itemId, branchId: null, delta });
    await recordMovement(conn, {
      itemId,
      type: 'outcome',
      quantity: Math.abs(delta),
      originBranchId: null,
      reason: reason || 'Egreso de stock sin asignar',
      createdBy,
    });
  }
  return { changed: true, quantity: target };
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
