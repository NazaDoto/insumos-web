import pool, { withTransaction } from '../config/db.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { ROLES } from '../middlewares/authorize.js';
import { writeLog, reqMeta } from '../utils/audit.js';

function ownerAdminId(req) {
  return req.user.role === ROLES.ADMIN ? req.user.id : req.body.administratorId || null;
}

async function loadOptions(fieldIds) {
  if (!fieldIds.length) return {};
  const [opts] = await pool.query(
    'SELECT * FROM custom_field_options WHERE field_id IN (?) ORDER BY sort_order, id',
    [fieldIds]
  );
  const map = {};
  for (const o of opts) {
    (map[o.field_id] ||= []).push({ id: o.id, value: o.value, label: o.label });
  }
  return map;
}

export const list = asyncHandler(async (req, res) => {
  const params = {};
  let where = '1=1';
  if (req.user.role === ROLES.ADMIN) {
    where = '(administrator_id = :uid OR administrator_id IS NULL)';
    params.uid = req.user.id;
  }
  if (req.query.module) {
    where += ' AND module = :module';
    params.module = req.query.module;
  }
  const [rows] = await pool.execute(`SELECT * FROM custom_fields WHERE ${where} ORDER BY module, sort_order, id`, params);
  const optMap = await loadOptions(rows.map((r) => r.id));
  res.json({ success: true, data: rows.map((r) => ({ ...r, options: optMap[r.id] || [] })) });
});

export const byModule = asyncHandler(async (req, res) => {
  const params = { module: req.params.module };
  let where = 'module = :module AND is_active = 1';
  if (req.user.role === ROLES.ADMIN) {
    where += ' AND (administrator_id = :uid OR administrator_id IS NULL)';
    params.uid = req.user.id;
  } else if (req.user.role === ROLES.EMPLOYEE) {
    where += ' AND (administrator_id = :uid OR administrator_id IS NULL)';
    params.uid = req.user.administrator_id;
  }
  const [rows] = await pool.execute(`SELECT * FROM custom_fields WHERE ${where} ORDER BY sort_order, id`, params);
  const optMap = await loadOptions(rows.map((r) => r.id));
  res.json({ success: true, data: rows.map((r) => ({ ...r, options: optMap[r.id] || [] })) });
});

export const create = asyncHandler(async (req, res) => {
  const { module, fieldName, fieldLabel, fieldType, isRequired, options } = req.body;
  const id = await withTransaction(async (conn) => {
    const [r] = await conn.execute(
      `INSERT INTO custom_fields (administrator_id, module, field_name, field_label, field_type, is_required)
       VALUES (:a,:m,:fn,:fl,:ft,:req)`,
      { a: ownerAdminId(req), m: module, fn: fieldName, fl: fieldLabel, ft: fieldType, req: isRequired ? 1 : 0 }
    );
    if (fieldType === 'select' && Array.isArray(options)) {
      for (let i = 0; i < options.length; i++) {
        const o = options[i];
        await conn.execute(
          'INSERT INTO custom_field_options (field_id, value, label, sort_order) VALUES (:f,:v,:l,:s)',
          { f: r.insertId, v: o.value ?? o, l: o.label ?? o, s: i }
        );
      }
    }
    return r.insertId;
  });
  await writeLog({ ...reqMeta(req), action: 'create', module: 'custom_fields', recordId: id, newValue: { fieldName, module } });
  res.status(201).json({ success: true, data: { id } });
});

async function fetchScoped(req, id) {
  const [rows] = await pool.execute('SELECT * FROM custom_fields WHERE id=:id', { id });
  const f = rows[0];
  if (!f) throw ApiError.notFound('Atributo no encontrado');
  if (req.user.role === ROLES.ADMIN && f.administrator_id && f.administrator_id !== req.user.id)
    throw ApiError.forbidden('Sin acceso a este atributo');
  return f;
}

export const update = asyncHandler(async (req, res) => {
  const f = await fetchScoped(req, req.params.id);
  const { fieldLabel, isRequired, isActive, options } = req.body;
  await withTransaction(async (conn) => {
    await conn.execute(
      'UPDATE custom_fields SET field_label=:fl, is_required=:req, is_active=:act WHERE id=:id',
      {
        fl: fieldLabel ?? f.field_label,
        req: isRequired !== undefined ? (isRequired ? 1 : 0) : f.is_required,
        act: isActive !== undefined ? (isActive ? 1 : 0) : f.is_active,
        id: f.id,
      }
    );
    if (Array.isArray(options)) {
      await conn.execute('DELETE FROM custom_field_options WHERE field_id=:f', { f: f.id });
      for (let i = 0; i < options.length; i++) {
        const o = options[i];
        await conn.execute(
          'INSERT INTO custom_field_options (field_id, value, label, sort_order) VALUES (:f,:v,:l,:s)',
          { f: f.id, v: o.value ?? o, l: o.label ?? o, s: i }
        );
      }
    }
  });
  await writeLog({ ...reqMeta(req), action: 'update', module: 'custom_fields', recordId: f.id });
  res.json({ success: true, message: 'Atributo actualizado' });
});

export const remove = asyncHandler(async (req, res) => {
  const f = await fetchScoped(req, req.params.id);
  // Desactivar para preservar historico de valores.
  await pool.execute('UPDATE custom_fields SET is_active=0 WHERE id=:id', { id: f.id });
  await writeLog({ ...reqMeta(req), action: 'deactivate', module: 'custom_fields', recordId: f.id });
  res.json({ success: true, message: 'Atributo desactivado' });
});
