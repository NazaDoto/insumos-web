import pool from '../config/db.js';
import env from '../config/env.js';
import { hashPassword } from '../utils/password.js';

async function ensureUser({ first, last, email, username, password, role, adminId = null }) {
  const [rows] = await pool.execute('SELECT id FROM users WHERE email = :email OR username = :username', {
    email,
    username,
  });
  if (rows.length) {
    console.log(`[seed] usuario ${username} ya existe (id ${rows[0].id})`);
    return rows[0].id;
  }
  const hash = await hashPassword(password);
  const [res] = await pool.execute(
    `INSERT INTO users (first_name, last_name, email, username, password_hash, role, administrator_id, status)
     VALUES (:first, :last, :email, :username, :hash, :role, :adminId, 'active')`,
    { first, last, email, username, hash, role, adminId }
  );
  console.log(`[seed] creado ${role} ${username} (id ${res.insertId})`);
  return res.insertId;
}

async function ensureCategories(adminId) {
  const cats = ['Informatica', 'Libreria', 'Limpieza', 'Herramientas', 'Mobiliario', 'Repuestos'];
  for (const name of cats) {
    const [rows] = await pool.execute(
      'SELECT id FROM item_categories WHERE name = :name AND (administrator_id = :adminId OR administrator_id IS NULL)',
      { name, adminId }
    );
    if (!rows.length) {
      await pool.execute(
        'INSERT INTO item_categories (administrator_id, name) VALUES (:adminId, :name)',
        { adminId, name }
      );
    }
  }
  console.log('[seed] categorías base aseguradas');
}

async function main() {
  console.log('[seed] iniciando...');

  // Administrador del sistema
  await ensureUser({
    first: 'Sistema',
    last: 'Admin',
    email: env.seed.email,
    username: env.seed.username,
    password: env.seed.password,
    role: 'sysadmin',
  });

  // Administrador de ejemplo
  const adminId = await ensureUser({
    first: 'Juan',
    last: 'Perez',
    email: 'admin1@nazadoto.com',
    username: 'admin1',
    password: 'Admin1234!',
    role: 'admin',
  });

  // Empleado de ejemplo vinculado al admin
  await ensureUser({
    first: 'Maria',
    last: 'Lopez',
    email: 'empleado1@nazadoto.com',
    username: 'empleado1',
    password: 'Empleado1234!',
    role: 'employee',
    adminId,
  });

  // Proveedor de ejemplo
  await ensureUser({
    first: 'Insumos',
    last: 'SA',
    email: 'proveedor1@nazadoto.com',
    username: 'proveedor1',
    password: 'Proveedor1234!',
    role: 'provider',
  });

  await ensureCategories(adminId);

  console.log('[seed] completado.');
  await pool.end();
}

main().catch((err) => {
  console.error('[seed] error:', err.message);
  process.exit(1);
});
