import { verifyToken } from '../utils/jwt.js';
import ApiError from '../utils/ApiError.js';
import pool from '../config/db.js';
import { writeLog, reqMeta } from '../utils/audit.js';

// Verifica el JWT y carga el usuario actualizado desde la base de datos.
export default async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) throw ApiError.unauthorized('Token no provisto');

    let payload;
    try {
      payload = verifyToken(token);
    } catch (e) {
      throw ApiError.unauthorized('Token invalido o expirado');
    }

    const [rows] = await pool.execute(
      `SELECT id, first_name, last_name, email, username, role, status,
              administrator_id, provider_id
       FROM users WHERE id = :id LIMIT 1`,
      { id: payload.sub }
    );
    const user = rows[0];
    if (!user) throw ApiError.unauthorized('Usuario inexistente');
    if (user.status !== 'active') {
      await writeLog({
        ...reqMeta(req),
        userId: user.id,
        userRole: user.role,
        action: 'access_denied_inactive',
        module: 'auth',
      });
      throw ApiError.forbidden('Usuario inactivo o bloqueado');
    }

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}
