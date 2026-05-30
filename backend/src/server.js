import app from './app.js';
import env from './config/env.js';
import pool from './config/db.js';

async function start() {
  try {
    const conn = await pool.getConnection();
    await conn.ping();
    conn.release();
    console.log(`[db] conectado a ${env.db.database}@${env.db.host}:${env.db.port}`);
  } catch (err) {
    console.error('[db] no se pudo conectar a MySQL:', err.message);
    console.error('     Verifica credenciales en .env y que la base exista (npm run db:init).');
  }

  app.listen(env.port, () => {
    console.log(`[api] escuchando en http://localhost:${env.port} (${env.nodeEnv})`);
  });
}

start();
