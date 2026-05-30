import ApiError from '../utils/ApiError.js';
import { writeLog, reqMeta } from '../utils/audit.js';

export const ROLES = {
  SYSADMIN: 'sysadmin',
  ADMIN: 'admin',
  PROVIDER: 'provider',
  EMPLOYEE: 'employee',
};

// Restringe el acceso a uno o varios roles.
export function authorize(...roles) {
  return async (req, res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (!roles.includes(req.user.role)) {
      await writeLog({
        ...reqMeta(req),
        action: 'unauthorized_access',
        module: req.baseUrl || 'unknown',
        newValue: { path: req.originalUrl, method: req.method },
      });
      return next(ApiError.forbidden('No tiene permisos para esta acción'));
    }
    next();
  };
}

/**
 * Devuelve el contexto de "tenant" del usuario:
 * - sysadmin: ve todo.
 * - admin: limitado a su administrator_id (su propio id).
 * - employee: limitado al administrator_id de su admin.
 * - provider: limitado a su provider_id.
 */
export function tenant(user) {
  switch (user.role) {
    case ROLES.SYSADMIN:
      return { isSysadmin: true, adminId: null, providerId: null };
    case ROLES.ADMIN:
      return { isSysadmin: false, adminId: user.id, providerId: null };
    case ROLES.EMPLOYEE:
      return { isSysadmin: false, adminId: user.administrator_id, providerId: null };
    case ROLES.PROVIDER:
      return { isSysadmin: false, adminId: null, providerId: user.provider_id || user.id };
    default:
      return { isSysadmin: false, adminId: null, providerId: null };
  }
}
