import ApiError from '../utils/ApiError.js';
import env from '../config/env.js';

export function notFound(req, res, next) {
  next(ApiError.notFound(`Ruta no encontrada: ${req.method} ${req.originalUrl}`));
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Error interno del servidor';

  // Errores comunes de MySQL.
  if (err.code === 'ER_DUP_ENTRY') {
    statusCode = 409;
    message = 'Ya existe un registro con esos datos';
  } else if (err.code === 'ER_NO_REFERENCED_ROW_2' || err.code === 'ER_ROW_IS_REFERENCED_2') {
    statusCode = 409;
    message = 'Operacion bloqueada por relaciones existentes';
  }

  if (statusCode >= 500) {
    console.error('[error]', err);
  }

  res.status(statusCode).json({
    success: false,
    message,
    details: err.details || undefined,
    stack: env.nodeEnv === 'development' && statusCode >= 500 ? err.stack : undefined,
  });
}
