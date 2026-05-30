import pool from '../config/db.js';

/**
 * Guarda valores de atributos dinamicos para un registro de un modulo.
 * values: { [fieldId]: value }
 */
export async function saveCustomValues(module, recordId, values, conn = pool, adminId = null) {
  if (!values || typeof values !== 'object') return;
  const fieldIds = Object.keys(values).map((k) => parseInt(k, 10)).filter(Boolean);
  if (!fieldIds.length) return;

  // Solo persiste valores de campos validos del modulo.
  const [fields] = await conn.query(
    'SELECT id FROM custom_fields WHERE id IN (?) AND module = ?',
    [fieldIds, module]
  );
  const valid = new Set(fields.map((f) => f.id));

  for (const fid of fieldIds) {
    if (!valid.has(fid)) continue;
    const value = values[fid];
    await conn.execute(
      `INSERT INTO custom_field_values (field_id, record_id, value) VALUES (:f,:r,:v)
       ON DUPLICATE KEY UPDATE value = :v`,
      { f: fid, r: recordId, v: value === null || value === undefined ? null : String(value) }
    );
  }
}

// Carga valores con etiqueta del campo para un registro.
export async function loadCustomValues(module, recordId, conn = pool) {
  const [rows] = await conn.execute(
    `SELECT cf.id AS field_id, cf.field_label, cf.field_type, cfv.value
     FROM custom_fields cf
     LEFT JOIN custom_field_values cfv ON cfv.field_id = cf.id AND cfv.record_id = :r
     WHERE cf.module = :m AND cf.is_active = 1
     ORDER BY cf.sort_order, cf.id`,
    { m: module, r: recordId }
  );
  return rows;
}
