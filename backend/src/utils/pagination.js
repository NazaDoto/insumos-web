// Normaliza parametros de paginacion y devuelve limit/offset seguros.
export function getPagination(query) {
  let page = parseInt(query.page, 10);
  let limit = parseInt(query.limit, 10);
  if (!Number.isInteger(page) || page < 1) page = 1;
  if (!Number.isInteger(limit) || limit < 1) limit = 20;
  if (limit > 100) limit = 100;
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

export function buildMeta(page, limit, total) {
  return { page, limit, total, pages: Math.ceil(total / limit) || 1 };
}
