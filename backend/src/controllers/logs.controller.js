import pool from '../config/db.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { ROLES } from '../middlewares/authorize.js';
import { getPagination, buildMeta } from '../utils/pagination.js';

function scopeWhere(req, params) {
  // El admin ve logs propios y de sus empleados.
  if (req.user.role === ROLES.ADMIN) {
    params.adminId = req.user.id;
    return '(l.user_id = :adminId OR l.user_id IN (SELECT id FROM users WHERE administrator_id = :adminId))';
  }
  return '1=1';
}

export const list = asyncHandler(async (req, res) => {
  const { page, limit, offset } = getPagination(req.query);
  const params = { limit, offset };
  const where = [scopeWhere(req, params)];
  if (req.query.module) { where.push('l.module = :module'); params.module = req.query.module; }
  if (req.query.action) { where.push('l.action = :action'); params.action = req.query.action; }
  if (req.query.userId) { where.push('l.user_id = :userId'); params.userId = req.query.userId; }
  if (req.query.from) { where.push('l.created_at >= :from'); params.from = req.query.from; }
  if (req.query.to) { where.push('l.created_at <= :to'); params.to = req.query.to; }
  const whereSql = `WHERE ${where.join(' AND ')}`;

  const [rows] = await pool.execute(
    `SELECT l.*, CONCAT(u.first_name,' ',u.last_name) AS user_name
     FROM logs l LEFT JOIN users u ON u.id = l.user_id
     ${whereSql}
     ORDER BY l.created_at DESC LIMIT ${limit} OFFSET ${offset}`,
    params
  );
  const [[{ total }]] = await pool.execute(`SELECT COUNT(*) AS total FROM logs l ${whereSql}`, params);
  res.json({ success: true, data: rows, meta: buildMeta(page, limit, total) });
});

export const getOne = asyncHandler(async (req, res) => {
  const [rows] = await pool.execute(
    `SELECT l.*, CONCAT(u.first_name,' ',u.last_name) AS user_name
     FROM logs l LEFT JOIN users u ON u.id=l.user_id WHERE l.id=:id`,
    { id: req.params.id }
  );
  if (!rows[0]) throw ApiError.notFound('Log no encontrado');
  res.json({ success: true, data: rows[0] });
});
