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
    database: env.db.database,
    multipleStatements: true,
  });

  const dir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();

  for (const file of files) {
    console.log(`[db:migrate] aplicando ${file}...`);
    const sql = fs.readFileSync(path.join(dir, file), 'utf8');
    try {
      await conn.query(sql);
      console.log(`[db:migrate] ${file} OK`);
    } catch (err) {
      if (err.code === 'ER_DUP_FIELDNAME' || err.code === 'ER_DUP_KEYNAME') {
        console.log(`[db:migrate] ${file} ya aplicada (${err.code}), se omite.`);
      } else {
        throw err;
      }
    }
  }

  console.log('[db:migrate] listo.');
  await conn.end();
}

main().catch((err) => {
  console.error('[db:migrate] error:', err.message);
  process.exit(1);
});
