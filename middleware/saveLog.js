const postgresql = require('../database/postgresql');

// Middleware de auditoría. Se coloca en la cadena de cada endpoint que muta
// datos, justo después de checkAuth y checkPermission, usando el mismo código
// de submódulo que checkPermission:
//
//   router.post('/reglas', checkAuth, checkPermission('rules_active'), saveLog('rules_active'), handler)
//
// Al terminar la respuesta, si fue exitosa (2xx) y hay usuario autenticado,
// registra en la tabla `logs`: el email del token, el submódulo (de ahí la
// vista resuelve la aplicación principal y el módulo) y la acción realizada.
// Un fallo al registrar el log nunca debe afectar la petición.
const METODOS_AUDITADOS = ['POST', 'PUT', 'DELETE', 'PATCH'];

function saveLog(submoduleCode) {
  return (req, res, next) => {
    res.on('finish', () => {
      if (!METODOS_AUDITADOS.includes(req.method)) return;
      if (res.statusCode < 200 || res.statusCode >= 300) return;
      const email = req.user && req.user.email;
      if (!email) return;

      const accion = `${req.method} ${req.baseUrl}${req.path}`;
      postgresql
        .insertLog(req.method.toLowerCase(), accion, email, submoduleCode, null)
        .catch((err) => console.error("No se pudo registrar el log de auditoría:", err.message));
    });
    next();
  };
}

module.exports = saveLog;
