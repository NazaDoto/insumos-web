import ApiError from '../utils/ApiError.js';

/**
 * Validador minimalista basado en esquemas declarativos.
 * schema: { campo: { required, type, min, max, enum, email, minLength, maxLength } }
 * Sanitiza recortando strings.
 */
export function validateBody(schema) {
  return (req, res, next) => {
    const errors = {};
    const data = req.body || {};

    for (const [field, rules] of Object.entries(schema)) {
      let value = data[field];

      if (typeof value === 'string') {
        value = value.trim();
        data[field] = value;
      }

      const empty = value === undefined || value === null || value === '';

      if (rules.required && empty) {
        errors[field] = 'Campo obligatorio';
        continue;
      }
      if (empty) continue;

      if (rules.type === 'number') {
        const n = Number(value);
        if (Number.isNaN(n)) {
          errors[field] = 'Debe ser un número';
          continue;
        }
        data[field] = n;
        if (rules.min !== undefined && n < rules.min)
          errors[field] = `Debe ser >= ${rules.min}`;
        if (rules.max !== undefined && n > rules.max)
          errors[field] = `Debe ser <= ${rules.max}`;
      }

      if (rules.type === 'integer') {
        const n = Number(value);
        if (!Number.isInteger(n)) {
          errors[field] = 'Debe ser un entero';
          continue;
        }
        data[field] = n;
        if (rules.min !== undefined && n < rules.min)
          errors[field] = `Debe ser >= ${rules.min}`;
      }

      if (rules.email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!re.test(value)) errors[field] = 'Email inválido';
      }

      if (rules.minLength && String(value).length < rules.minLength)
        errors[field] = `Mínimo ${rules.minLength} caracteres`;
      if (rules.maxLength && String(value).length > rules.maxLength)
        errors[field] = `Máximo ${rules.maxLength} caracteres`;

      if (rules.enum && !rules.enum.includes(value))
        errors[field] = `Valor inválido. Permitidos: ${rules.enum.join(', ')}`;
    }

    if (Object.keys(errors).length) {
      return next(ApiError.badRequest('Datos inválidos', errors));
    }
    req.body = data;
    next();
  };
}
