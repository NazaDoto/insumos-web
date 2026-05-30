import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';
import env from '../config/env.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const conn = await mysql.createConnection({
    host: env.db.host,
    port: env.db.port,
    user: env.db.user,
    password: env.db.password,
    multipleStatements: true,
  });

  console.log(`[db:init] creando base de datos "${env.db.database}" si no existe...`);
  await conn.query(
    `CREATE DATABASE IF NOT EXISTS \`${env.db.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`
  );
  await conn.query(`USE \`${env.db.database}\`;`);

  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  console.log('[db:init] aplicando schema.sql...');
  await conn.query(schema);

  console.log('[db:init] listo. Ejecuta "npm run db:seed" para datos iniciales.');
  await conn.end();
}

main().catch((err) => {
  console.error('[db:init] error:', err.message);
  process.exit(1);
});
