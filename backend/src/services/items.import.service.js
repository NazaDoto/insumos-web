import ExcelJS from 'exceljs';
import pool, { withTransaction } from '../config/db.js';
import ApiError from '../utils/ApiError.js';
import { ROLES } from '../middlewares/authorize.js';
import { applyStockDelta, recordMovement, getStockQty } from './stock.service.js';
import { saveCustomValues } from '../utils/customValues.js';

const IMPORTABLE_CUSTOM_TYPES = new Set(['text', 'textarea', 'number', 'date', 'boolean', 'select']);

const HEADER_MAP = {
  id_externo: 'externalRefId',
  'id externo': 'externalRefId',
  external_id: 'externalRefId',
  codigo: 'externalRefId',
  código: 'externalRefId',
  id: 'externalRefId',
  nombre: 'name',
  name: 'name',
  descripcion: 'description',
  descripción: 'description',
  description: 'description',
  categoria: 'categoryName',
  categoría: 'categoryName',
  category: 'categoryName',
  unidad: 'unit',
  unit: 'unit',
  stock_minimo: 'minimumStock',
  'stock minimo': 'minimumStock',
  'stock mínimo': 'minimumStock',
  minimum_stock: 'minimumStock',
  estado: 'status',
  status: 'status',
  sucursal: 'branchName',
  branch: 'branchName',
  oficina: 'branchName',
  stock: 'stockQty',
  cantidad: 'stockQty',
  quantity: 'stockQty',
  condicion: 'conditionState',
  condición: 'conditionState',
  condition: 'conditionState',
};

const VALID_STATUS = new Set(['active', 'inactive', 'activo', 'inactivo']);
const VALID_CONDITION = new Set([
  'available', 'in_use', 'repair', 'damaged', 'retired', 'reserved', 'lost',
  'disponible', 'en_uso', 'reparacion', 'reparación', 'dañado', 'danado', 'baja', 'reservado', 'perdido',
]);

const CONDITION_MAP = {
  disponible: 'available',
  en_uso: 'in_use',
  reparacion: 'repair',
  reparación: 'repair',
  dañado: 'damaged',
  danado: 'damaged',
  baja: 'retired',
  reservado: 'reserved',
  perdido: 'lost',
};

function normHeader(h) {
  return String(h || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function parseNumber(val) {
  if (val === null || val === undefined || val === '') return null;
  const n = Number(String(val).replace(',', '.'));
  return Number.isFinite(n) ? n : NaN;
}

function resolveOwner(req) {
  if (req.user.role === ROLES.PROVIDER) {
    return { ownerType: 'provider', ownerId: req.user.id };
  }
  if (req.user.role === ROLES.ADMIN) {
    return { ownerType: 'administrator', ownerId: req.user.id };
  }
  if (req.user.role === ROLES.SYSADMIN) {
    throw ApiError.badRequest('La importación de insumos está disponible para administradores y proveedores');
  }
  throw ApiError.forbidden('Sin permisos para importar insumos');
}

function cellToText(v) {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'object' && v.text !== undefined) return String(v.text);
  if (typeof v === 'object' && v.result !== undefined) return cellToText(v.result);
  return v;
}

async function loadItemCustomFields(conn, owner) {
  let where = "module = 'items' AND is_active = 1";
  const params = {};
  if (owner.ownerType === 'administrator') {
    where += ' AND (administrator_id = :uid OR administrator_id IS NULL)';
    params.uid = owner.ownerId;
  } else if (owner.ownerType === 'provider') {
    where += ' AND administrator_id IS NULL';
  } else {
    return [];
  }

  const [rows] = await conn.execute(
    `SELECT id, field_name, field_label, field_type, is_required
     FROM custom_fields WHERE ${where} ORDER BY sort_order, id`,
    params
  );

  const importable = rows.filter((r) => IMPORTABLE_CUSTOM_TYPES.has(r.field_type));
  if (!importable.length) return [];

  const ids = importable.map((r) => r.id);
  const [opts] = await conn.query(
    'SELECT field_id, value, label FROM custom_field_options WHERE field_id IN (?) ORDER BY sort_order, id',
    [ids]
  );
  const optMap = {};
  for (const o of opts) {
    (optMap[o.field_id] ||= []).push(o);
  }
  return importable.map((r) => ({ ...r, options: optMap[r.id] || [] }));
}

function buildCustomFieldHeaderMap(customFields) {
  const headerToFieldId = {};
  const fieldsById = {};
  for (const f of customFields) {
    fieldsById[f.id] = f;
    const keys = [
      f.field_name,
      f.field_label,
      `atributo_${f.field_name}`,
      `attr_${f.field_name}`,
    ];
    for (const k of keys) {
      headerToFieldId[normHeader(k)] = f.id;
    }
  }
  return { headerToFieldId, fieldsById };
}

function resolveSelectOption(field, raw) {
  const key = String(raw).trim().toLowerCase();
  for (const o of field.options || []) {
    if (String(o.value).trim().toLowerCase() === key) return o.value;
    if (String(o.label).trim().toLowerCase() === key) return o.value;
  }
  return null;
}

function normalizeBooleanValue(raw) {
  const k = String(raw).trim().toLowerCase();
  if (['1', 'si', 'sí', 'yes', 'true', 'verdadero'].includes(k)) return '1';
  if (['0', 'no', 'false', 'falso'].includes(k)) return '0';
  return null;
}

function normalizeCustomValue(field, raw) {
  if (raw === null || raw === undefined) return null;
  const str = String(cellToText(raw) ?? raw).trim();
  if (!str) return null;

  switch (field.field_type) {
    case 'number': {
      const n = parseNumber(str);
      return Number.isNaN(n) ? null : String(n);
    }
    case 'boolean': {
      return normalizeBooleanValue(str);
    }
    case 'date': {
      if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);
      const d = new Date(str);
      return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
    }
    case 'select':
      return resolveSelectOption(field, str);
    default:
      return str;
  }
}

function validateCustomValues(row, fieldsById) {
  const errors = [];
  const values = row.customValues || {};

  for (const field of Object.values(fieldsById)) {
    const raw = values[field.id];
    const hasValue = raw !== undefined && raw !== null && String(raw).trim() !== '';

    if (field.is_required && !hasValue) {
      errors.push({ field: field.field_label, message: 'Atributo obligatorio' });
      continue;
    }
    if (!hasValue) {
      delete values[field.id];
      continue;
    }

    const normalized = normalizeCustomValue(field, raw);
    if (normalized === null) {
      let hint = 'Valor inválido';
      if (field.field_type === 'select') {
        const opts = (field.options || []).map((o) => o.label || o.value).join(', ');
        hint = `Valor no válido. Opciones: ${opts}`;
      } else if (field.field_type === 'boolean') {
        hint = 'Use Si o No (o 1 / 0)';
      } else if (field.field_type === 'number') {
        hint = 'Debe ser un número';
      } else if (field.field_type === 'date') {
        hint = 'Fecha inválida (AAAA-MM-DD)';
      }
      errors.push({ field: field.field_label, message: hint });
      continue;
    }
    values[field.id] = normalized;
  }

  row.customValues = values;
  return errors;
}

export async function parseImportWorkbook(buffer, customFields = []) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const sheet = wb.worksheets[0];
  if (!sheet) throw ApiError.badRequest('El archivo Excel no contiene hojas');

  const { headerToFieldId } = buildCustomFieldHeaderMap(customFields);
  const headerRow = sheet.getRow(1);
  const colMap = {};
  let hasName = false;

  headerRow.eachCell((cell, col) => {
    const h = normHeader(cell.value);
    const stdKey = HEADER_MAP[h];
    if (stdKey) {
      colMap[col] = { kind: 'std', key: stdKey };
      if (stdKey === 'name') hasName = true;
      return;
    }
    const fieldId = headerToFieldId[h];
    if (fieldId) {
      colMap[col] = { kind: 'custom', fieldId };
    }
  });

  if (!hasName) {
    throw ApiError.badRequest(
      'Falta la columna obligatoria "nombre". Revise la plantilla de importación.'
    );
  }

  const rows = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const data = { _row: rowNumber, customValues: {} };
    let hasData = false;
    row.eachCell((cell, col) => {
      const mapped = colMap[col];
      if (!mapped) return;
      const text = cellToText(cell.value);
      if (text === null || text === undefined || String(text).trim() === '') return;
      hasData = true;
      if (mapped.kind === 'std') {
        data[mapped.key] = text;
      } else {
        data.customValues[mapped.fieldId] = text;
      }
    });
    if (hasData) rows.push(data);
  });

  if (!rows.length) throw ApiError.badRequest('No se encontraron filas de datos en el Excel');
  return rows;
}

function validateRow(row, owner) {
  const errors = [];
  const externalRefId = row.externalRefId != null ? String(row.externalRefId).trim() : '';
  const name = row.name != null ? String(row.name).trim() : '';

  if (!name) errors.push({ field: 'nombre', message: 'El nombre es obligatorio' });

  if (row.minimumStock !== undefined) {
    const min = parseNumber(row.minimumStock);
    if (Number.isNaN(min) || min < 0) errors.push({ field: 'stock_minimo', message: 'Stock mínimo inválido' });
  }

  if (row.stockQty !== undefined) {
    const stock = parseNumber(row.stockQty);
    if (Number.isNaN(stock) || stock < 0) errors.push({ field: 'stock', message: 'Cantidad de stock inválida' });
  }

  if (row.status !== undefined) {
    const st = String(row.status).trim().toLowerCase();
    if (!VALID_STATUS.has(st)) errors.push({ field: 'estado', message: 'Estado inválido (active/inactive o activo/inactivo)' });
  }

  if (row.conditionState !== undefined) {
    const cs = String(row.conditionState).trim().toLowerCase();
    if (!VALID_CONDITION.has(cs)) {
      errors.push({ field: 'condicion', message: 'Condición inválida (ej: disponible, en_uso, dañado)' });
    }
  }

  return { externalRefId, name, errors };
}

function mergeRowErrors(base, extra) {
  return [...base, ...extra];
}

async function loadCategories(conn, owner) {
  const adminId = owner.ownerType === 'administrator' ? owner.ownerId : null;
  const [rows] = await conn.execute(
    `SELECT id, name FROM item_categories
     WHERE status='active' AND (administrator_id IS NULL OR administrator_id = :aid)`,
    { aid: adminId || owner.ownerId }
  );
  const map = new Map();
  for (const c of rows) map.set(c.name.trim().toLowerCase(), c.id);
  return map;
}

async function loadBranches(conn, owner) {
  if (owner.ownerType !== 'administrator') return new Map();
  const [rows] = await conn.execute(
    `SELECT id, name FROM branches WHERE administrator_id = :aid AND status='active' ORDER BY name`,
    { aid: owner.ownerId }
  );
  const map = new Map();
  for (const b of rows) map.set(b.name.trim().toLowerCase(), { id: b.id, name: b.name });
  return map;
}

/**
 * Resuelve dónde cargar el stock cuando la fila del Excel no trae sucursal:
 * - Si indicó nombre: debe existir entre las sucursales activas.
 * - Si tiene una sola sucursal: se usa esa (el stock aparece en Stock disponible).
 * - Si tiene varias o ninguna: stock general (branch_id NULL, "Sin asignar" en detalle).
 */
function resolveImportBranch(branchMap, branchName) {
  const key = String(branchName || '').trim().toLowerCase();
  if (key) {
    const hit = branchMap.get(key);
    if (!hit) {
      return { error: `Sucursal "${String(branchName).trim()}" no encontrada` };
    }
    return { branchId: hit.id, locationLabel: hit.name };
  }
  if (branchMap.size === 1) {
    const [, only] = [...branchMap.entries()][0];
    return { branchId: only.id, locationLabel: only.name, autoAssigned: true };
  }
  return { branchId: null, locationLabel: 'Sin sucursal (stock general)' };
}

async function findItemByExternalRef(conn, owner, externalRefId) {
  const [rows] = await conn.execute(
    `SELECT * FROM items WHERE owner_type = :ot AND owner_id = :oid AND external_ref_id = :ref`,
    { ot: owner.ownerType, oid: owner.ownerId, ref: externalRefId }
  );
  return rows[0] || null;
}

async function resolveCategoryId(conn, owner, categoryName, categoryMap) {
  if (!categoryName) return null;
  const key = String(categoryName).trim().toLowerCase();
  if (categoryMap.has(key)) return categoryMap.get(key);

  const adminId = owner.ownerType === 'administrator' ? owner.ownerId : null;
  const [r] = await conn.execute(
    `INSERT INTO item_categories (administrator_id, name, status) VALUES (:aid, :n, 'active')`,
    { aid: adminId, n: String(categoryName).trim() }
  );
  categoryMap.set(key, r.insertId);
  return r.insertId;
}

function normalizeStatus(status) {
  if (!status) return 'active';
  const s = String(status).trim().toLowerCase();
  if (s === 'activo' || s === 'active') return 'active';
  if (s === 'inactivo' || s === 'inactive') return 'inactive';
  return 'active';
}

function normalizeCondition(cs) {
  if (!cs) return 'available';
  const key = String(cs).trim().toLowerCase();
  return CONDITION_MAP[key] || key;
}

async function applyStockFromImport(conn, { itemId, branchId, targetQty, userId, isNew }) {
  const current = await getStockQty(conn, { itemId, branchId });
  const currentQty = current ? Number(current.quantity) : 0;
  const target = Number(targetQty);

  if (isNew) {
    if (target <= 0) return { movement: null, skipped: true };
    await applyStockDelta(conn, { itemId, branchId, delta: target });
    await recordMovement(conn, {
      itemId,
      type: 'income',
      quantity: target,
      destinationBranchId: branchId,
      reason: 'Importación Excel',
      createdBy: userId,
    });
    return { movement: 'income', quantity: target };
  }

  const delta = target - currentQty;
  if (delta === 0) return { movement: null, skipped: true };

  if (delta > 0) {
    await applyStockDelta(conn, { itemId, branchId, delta });
    await recordMovement(conn, {
      itemId,
      type: 'income',
      quantity: delta,
      destinationBranchId: branchId,
      reason: 'Importación Excel (actualización)',
      createdBy: userId,
    });
    return { movement: 'income', quantity: delta };
  }

  await applyStockDelta(conn, { itemId, branchId, delta });
  await recordMovement(conn, {
    itemId,
    type: 'outcome',
    quantity: Math.abs(delta),
    originBranchId: branchId,
    reason: 'Importación Excel (ajuste a stock del archivo)',
    createdBy: userId,
  });
  return { movement: 'outcome', quantity: Math.abs(delta) };
}

async function applyStockFromImportProvider(conn, { itemId, providerId, targetQty, userId, isNew }) {
  const current = await getStockQty(conn, { itemId, providerId });
  const currentQty = current ? Number(current.quantity) : 0;
  const target = Number(targetQty);

  if (isNew) {
    if (target <= 0) return { movement: null, skipped: true };
    await applyStockDelta(conn, { itemId, providerId, delta: target });
    await recordMovement(conn, {
      itemId,
      type: 'income',
      quantity: target,
      providerId,
      reason: 'Importación Excel',
      createdBy: userId,
    });
    return { movement: 'income', quantity: target };
  }

  const delta = target - currentQty;
  if (delta === 0) return { movement: null, skipped: true };

  if (delta > 0) {
    await applyStockDelta(conn, { itemId, providerId, delta });
    await recordMovement(conn, {
      itemId,
      type: 'income',
      quantity: delta,
      providerId,
      reason: 'Importación Excel (actualización)',
      createdBy: userId,
    });
    return { movement: 'income', quantity: delta };
  }

  await applyStockDelta(conn, { itemId, providerId, delta });
  await recordMovement(conn, {
    itemId,
    type: 'outcome',
    quantity: Math.abs(delta),
    providerId,
    reason: 'Importación Excel (ajuste a stock del archivo)',
    createdBy: userId,
  });
  return { movement: 'outcome', quantity: Math.abs(delta) };
}

export async function importItemsFromExcel(req, buffer) {
  const owner = resolveOwner(req);
  const customFields = await loadItemCustomFields(pool, owner);
  const parsedRows = await parseImportWorkbook(buffer, customFields);
  const { fieldsById } = buildCustomFieldHeaderMap(customFields);
  const events = [{ type: 'start', total: parsedRows.length }];
  const errors = [];
  let created = 0;
  let updated = 0;
  let stockMovements = 0;

  await withTransaction(async (conn) => {
    const categoryMap = await loadCategories(conn, owner);
    const branchMap = await loadBranches(conn, owner);

    for (const row of parsedRows) {
      const rowNum = row._row;
      const { externalRefId, name, errors: baseErrors } = validateRow(row, owner);
      const rowErrors = mergeRowErrors(baseErrors, validateCustomValues(row, fieldsById));

      if (rowErrors.length) {
        for (const e of rowErrors) {
          errors.push({ row: rowNum, externalRefId: externalRefId || null, field: e.field, message: e.message });
        }
        events.push({
          type: 'error',
          row: rowNum,
          externalRefId: externalRefId || null,
          name: name || null,
          messages: rowErrors.map((e) => `${e.field}: ${e.message}`),
        });
        continue;
      }

      const categoryId = await resolveCategoryId(conn, owner, row.categoryName, categoryMap);
      const minimumStock = row.minimumStock !== undefined ? parseNumber(row.minimumStock) : 0;
      const status = normalizeStatus(row.status);
      const conditionState = normalizeCondition(row.conditionState);
      const description = row.description != null ? String(row.description).trim() : null;
      const unit = row.unit != null ? String(row.unit).trim() : 'unidad';

      let existing = null;
      if (externalRefId) {
        existing = await findItemByExternalRef(conn, owner, externalRefId);
      }

      let itemId;
      let action;

      if (existing) {
        await conn.execute(
          `UPDATE items SET name=:n, description=:d, unit=:u, minimum_stock=:min,
             category_id=:cat, status=:st, condition_state=:cs WHERE id=:id`,
          {
            n: name,
            d: description,
            u: unit,
            min: minimumStock ?? existing.minimum_stock,
            cat: categoryId ?? existing.category_id,
            st: status,
            cs: conditionState,
            id: existing.id,
          }
        );
        itemId = existing.id;
        action = 'updated';
        updated += 1;
      } else {
        const [ins] = await conn.execute(
          `INSERT INTO items (external_ref_id, owner_type, owner_id, category_id, name, description, unit,
             minimum_stock, status, condition_state, created_by)
           VALUES (:ref,:ot,:oid,:cat,:n,:d,:u,:min,:st,:cs,:by)`,
          {
            ref: externalRefId || null,
            ot: owner.ownerType,
            oid: owner.ownerId,
            cat: categoryId,
            n: name,
            d: description,
            u: unit,
            min: minimumStock || 0,
            st: status,
            cs: conditionState,
            by: req.user.id,
          }
        );
        itemId = ins.insertId;
        action = 'created';
        created += 1;
      }

      if (row.customValues && Object.keys(row.customValues).length) {
        await saveCustomValues('items', itemId, row.customValues, conn);
      }

      let stockDetail = null;
      if (row.stockQty !== undefined) {
        const stockQty = parseNumber(row.stockQty);
        if (owner.ownerType === 'administrator') {
          const branchRes = resolveImportBranch(branchMap, row.branchName);
          if (branchRes.error) {
            errors.push({ row: rowNum, externalRefId: externalRefId || null, field: 'sucursal', message: branchRes.error });
            events.push({
              type: 'error',
              row: rowNum,
              externalRefId: externalRefId || null,
              name,
              messages: [branchRes.error],
            });
          } else {
            stockDetail = await applyStockFromImport(conn, {
              itemId,
              branchId: branchRes.branchId,
              targetQty: stockQty,
              userId: req.user.id,
              isNew: action === 'created',
            });
            if (stockDetail) {
              stockDetail.locationLabel = branchRes.locationLabel;
              stockDetail.autoAssigned = !!branchRes.autoAssigned;
            }
            if (stockDetail?.movement) stockMovements += 1;
          }
        } else if (owner.ownerType === 'provider') {
          stockDetail = await applyStockFromImportProvider(conn, {
            itemId,
            providerId: owner.ownerId,
            targetQty: stockQty,
            userId: req.user.id,
            isNew: action === 'created',
          });
          if (stockDetail?.movement) stockMovements += 1;
        }
      }

      events.push({
        type: 'row',
        row: rowNum,
        action,
        externalRefId: externalRefId || null,
        name,
        itemId,
        stock: stockDetail,
      });
    }
  });

  events.push({
    type: 'done',
    summary: {
      total: parsedRows.length,
      created,
      updated,
      stockMovements,
      errors: errors.length,
      success: errors.length === 0,
    },
  });

  return { events, errors, summary: events[events.length - 1].summary };
}

export async function buildImportTemplate(req) {
  const owner = resolveOwner(req);
  const customFields = await loadItemCustomFields(pool, owner);

  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet('Insumos');
  const baseColumns = [
    { header: 'id_externo', key: 'id_externo', width: 14 },
    { header: 'nombre', key: 'nombre', width: 28 },
    { header: 'descripcion', key: 'descripcion', width: 32 },
    { header: 'categoria', key: 'categoria', width: 18 },
    { header: 'unidad', key: 'unidad', width: 12 },
    { header: 'stock_minimo', key: 'stock_minimo', width: 14 },
    { header: 'estado', key: 'estado', width: 12 },
    { header: 'condicion', key: 'condicion', width: 14 },
    { header: 'sucursal', key: 'sucursal', width: 20 },
    { header: 'stock', key: 'stock', width: 12 },
  ];
  const attrColumns = customFields.map((f) => ({
    header: f.field_name,
    key: f.field_name,
    width: Math.max(14, Math.min(24, f.field_label.length + 2)),
  }));
  sheet.columns = [...baseColumns, ...attrColumns];
  sheet.getRow(1).font = { bold: true };

  const example1 = {
    id_externo: 'INS-001',
    nombre: 'Ejemplo: Resma A4',
    descripcion: 'Opcional',
    categoria: 'Papelería',
    unidad: 'unidad',
    stock_minimo: 10,
    estado: 'activo',
    condicion: 'disponible',
    sucursal: 'Casa Central',
    stock: 50,
  };
  const example2 = {
    id_externo: 'INS-002',
    nombre: 'Ejemplo con stock sin sucursal',
    categoria: 'Limpieza',
    unidad: 'litro',
    stock_minimo: 5,
    estado: 'activo',
    condicion: 'disponible',
    stock: 25,
  };
  const example3 = {
    id_externo: 'INS-003',
    nombre: 'Ejemplo sin stock inicial',
    categoria: 'Varios',
    unidad: 'unidad',
    stock_minimo: 0,
    estado: 'activo',
    condicion: 'disponible',
  };

  for (const f of customFields) {
    if (f.field_type === 'select' && f.options?.length) {
      example1[f.field_name] = f.options[0].label || f.options[0].value;
    } else if (f.field_type === 'boolean') {
      example1[f.field_name] = 'Si';
    } else if (f.field_type === 'number') {
      example1[f.field_name] = 1;
    } else if (f.field_type === 'date') {
      example1[f.field_name] = '2026-01-15';
    } else {
      example1[f.field_name] = `Ej. ${f.field_label}`;
    }
  }

  sheet.addRow(example1);
  sheet.addRow(example2);
  sheet.addRow(example3);

  if (customFields.length) {
    const help = wb.addWorksheet('Atributos');
    help.columns = [
      { header: 'columna_excel', key: 'col', width: 22 },
      { header: 'etiqueta', key: 'label', width: 24 },
      { header: 'tipo', key: 'type', width: 12 },
      { header: 'obligatorio', key: 'req', width: 12 },
      { header: 'opciones', key: 'opts', width: 40 },
    ];
    help.getRow(1).font = { bold: true };
    for (const f of customFields) {
      help.addRow({
        col: f.field_name,
        label: f.field_label,
        type: f.field_type,
        req: f.is_required ? 'Si' : 'No',
        opts: f.field_type === 'select'
          ? (f.options || []).map((o) => o.label || o.value).join(', ')
          : f.field_type === 'boolean'
            ? 'Si, No'
            : '',
      });
    }
  }

  return wb;
}
