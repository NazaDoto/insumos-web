import ExcelJS from 'exceljs';
import pool, { withTransaction } from '../config/db.js';
import ApiError from '../utils/ApiError.js';
import { ROLES } from '../middlewares/authorize.js';
import { applyStockDelta, recordMovement, getStockQty } from './stock.service.js';

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

export async function parseImportWorkbook(buffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const sheet = wb.worksheets[0];
  if (!sheet) throw ApiError.badRequest('El archivo Excel no contiene hojas');

  const headerRow = sheet.getRow(1);
  const colMap = {};
  headerRow.eachCell((cell, col) => {
    const key = HEADER_MAP[normHeader(cell.value)];
    if (key) colMap[col] = key;
  });

  if (!Object.values(colMap).includes('name')) {
    throw ApiError.badRequest(
      'Falta la columna obligatoria "nombre". Revise la plantilla de importación.'
    );
  }

  const rows = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const data = { _row: rowNumber };
    let hasData = false;
    row.eachCell((cell, col) => {
      const field = colMap[col];
      if (!field) return;
      const v = cell.value;
      const text = v && typeof v === 'object' && v.text !== undefined ? v.text : v;
      if (text !== null && text !== undefined && String(text).trim() !== '') {
        hasData = true;
        data[field] = text;
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
    else     if (stock > 0 && owner?.ownerType === 'administrator' && !String(row.branchName || '').trim()) {
      errors.push({ field: 'sucursal', message: 'Indique sucursal cuando carga stock' });
    }
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
    `SELECT id, name FROM branches WHERE administrator_id = :aid AND status='active'`,
    { aid: owner.ownerId }
  );
  const map = new Map();
  for (const b of rows) map.set(b.name.trim().toLowerCase(), b.id);
  return map;
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
  const parsedRows = await parseImportWorkbook(buffer);
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
      const { externalRefId, name, errors: rowErrors } = validateRow(row, owner);

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

      let stockDetail = null;
      if (row.stockQty !== undefined) {
        const stockQty = parseNumber(row.stockQty);
        if (owner.ownerType === 'administrator') {
          const branchKey = String(row.branchName || '').trim().toLowerCase();
          const branchId = branchMap.get(branchKey);
          if (!branchId) {
            const msg = `Sucursal "${row.branchName}" no encontrada`;
            errors.push({ row: rowNum, externalRefId: externalRefId || null, field: 'sucursal', message: msg });
            events.push({
              type: 'error',
              row: rowNum,
              externalRefId: externalRefId || null,
              name,
              messages: [msg],
            });
          } else {
            stockDetail = await applyStockFromImport(conn, {
              itemId,
              branchId,
              targetQty: stockQty,
              userId: req.user.id,
              isNew: action === 'created',
            });
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

export async function buildImportTemplate() {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet('Insumos');
  sheet.columns = [
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
  sheet.getRow(1).font = { bold: true };
  sheet.addRow({
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
  });
  sheet.addRow({
    id_externo: 'INS-002',
    nombre: 'Ejemplo sin stock inicial',
    categoria: 'Limpieza',
    unidad: 'litro',
    stock_minimo: 5,
    estado: 'activo',
    condicion: 'disponible',
  });
  return wb;
}
