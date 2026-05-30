// Envuelve controladores async para reenviar errores al middleware central.
export default function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}
