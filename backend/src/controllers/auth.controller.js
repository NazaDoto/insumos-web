import pool from '../config/db.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { signToken } from '../utils/jwt.js';
import { hashPassword, comparePassword } from '../utils/password.js';
import { writeLog, reqMeta } from '../utils/audit.js';

function publicUser(u) {
  return {
    id: u.id,
    firstName: u.first_name,
    lastName: u.last_name,
    email: u.email,
    username: u.username,
    role: u.role,
    status: u.status,
    administratorId: u.administrator_id,
    providerId: u.provider_id,
  };
}

export const login = asyncHandler(async (req, res) => {
  const { identifier, password } = req.body;

  const [rows] = await pool.execute(
    `SELECT * FROM users WHERE email = :id OR username = :id LIMIT 1`,
    { id: identifier }
  );
  const user = rows[0];

  if (!user || !(await comparePassword(password, user.password_hash))) {
    await writeLog({
      ...reqMeta(req),
      userId: user?.id ?? null,
      userRole: user?.role ?? null,
      action: 'login_failed',
      module: 'auth',
      newValue: { identifier },
    });
    throw ApiError.unauthorized('Credenciales inválidas');
  }

  if (user.status !== 'active') {
    throw ApiError.forbidden('Usuario inactivo o bloqueado');
  }

  const token = signToken({ sub: user.id, role: user.role });

  await writeLog({
    ...reqMeta(req),
    userId: user.id,
    userRole: user.role,
    action: 'login_success',
    module: 'auth',
  });

  res.json({ success: true, token, user: publicUser(user) });
});

export const me = asyncHandler(async (req, res) => {
  res.json({ success: true, user: publicUser(req.user) });
});

export const logout = asyncHandler(async (req, res) => {
  // Con JWT stateless el logout se maneja en el cliente; registramos la acción.
  await writeLog({ ...reqMeta(req), action: 'logout', module: 'auth' });
  res.json({ success: true, message: 'Sesión cerrada' });
});

export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  const [rows] = await pool.execute('SELECT password_hash FROM users WHERE id = :id', {
    id: req.user.id,
  });
  const ok = await comparePassword(currentPassword, rows[0].password_hash);
  if (!ok) throw ApiError.badRequest('La contraseña actual es incorrecta');

  const hash = await hashPassword(newPassword);
  await pool.execute('UPDATE users SET password_hash = :hash WHERE id = :id', {
    hash,
    id: req.user.id,
  });

  await writeLog({ ...reqMeta(req), action: 'change_password', module: 'auth', recordId: req.user.id });
  res.json({ success: true, message: 'Contraseña actualizada' });
});
