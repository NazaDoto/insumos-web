import mysql from 'mysql2/promise';
import env from './env.js';

// Pool de conexiones con consultas preparadas (mysql2) para evitar inyeccion SQL.
const pool = mysql.createPool({
  host: env.db.host,
  port: env.db.port,
  user: env.db.user,
  password: env.db.password,
  database: env.db.database,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  namedPlaceholders: true,
  decimalNumbers: true,
});

/**
 * Ejecuta una funcion dentro de una transaccion.
 * Garantiza atomicidad para movimientos de stock, pedidos, etc.
 */
export async function withTransaction(fn) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export default pool;
