import pool from '../config/db.js';

/**
 * Registra una acción en la tabla de logs de auditoría.
 * Acepta opcionalmente una conexion para participar de una transaccion.
 */
export async function writeLog(
  {
    userId = null,
    userRole = null,
    action,
    module,
    recordId = null,
    oldValue = null,
    newValue = null,
    ip = null,
    userAgent = null,
  },
  conn = pool
) {
  try {
    await conn.execute(
      `INSERT INTO logs (user_id, user_role, action, module, record_id, old_value, new_value, ip_address, user_agent)
       VALUES (:userId, :userRole, :action, :module, :recordId, :oldValue, :newValue, :ip, :userAgent)`,
      {
        userId,
        userRole,
        action,
        module,
        recordId,
        oldValue: oldValue ? JSON.stringify(oldValue) : null,
        newValue: newValue ? JSON.stringify(newValue) : null,
        ip,
        userAgent,
      }
    );
  } catch (err) {
    // El log nunca debe romper la operacion principal.
    console.error('[audit] error al escribir log:', err.message);
  }
}

// Extrae datos de auditoría del request.
export function reqMeta(req) {
  return {
    userId: req.user?.id ?? null,
    userRole: req.user?.role ?? null,
    ip: req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || null,
    userAgent: req.headers['user-agent'] || null,
  };
}
