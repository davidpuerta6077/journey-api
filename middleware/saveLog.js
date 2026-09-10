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
//
// Segundo argumento opcional para descripciones legibles y auditar GET:
//   saveLog('reports', {
//     descripcion: (req) => `Creó reporte "${req.body?.nombre}"`,  // string o (req,res)=>string
//     entityId:    (req) => req.params.id,                          // valor o (req)=>valor
//     incluirGet:  true,                                            // también audita GET 2xx
//   })
// Sin el segundo argumento, se comporta igual que antes: audita POST/PUT/DELETE/
// PATCH con descripción `MÉTODO /ruta`.
const METODOS_AUDITADOS = ['POST', 'PUT', 'DELETE', 'PATCH'];

function saveLog(submoduleCode, options = {}) {
  const { descripcion, entityId, incluirGet = false } = options;

  return (req, res, next) => {
    res.on('finish', () => {
      const auditado = METODOS_AUDITADOS.includes(req.method) || (incluirGet && req.method === 'GET');
      if (!auditado) return;
      if (res.statusCode < 200 || res.statusCode >= 300) return;
      const email = req.user && req.user.email;
      if (!email) return;

      const porDefecto = `${req.method} ${req.baseUrl}${req.path}`;
      let accion = porDefecto;
      try {
        if (typeof descripcion === 'function') accion = descripcion(req, res) || porDefecto;
        else if (typeof descripcion === 'string') accion = descripcion;
      } catch {
        accion = porDefecto;
      }

      let eid = null;
      try {
        eid = typeof entityId === 'function' ? entityId(req) : (entityId ?? null);
      } catch {
        eid = null;
      }

      postgresql
        .insertLog(req.method.toLowerCase(), accion, email, submoduleCode, eid)
        .catch((err) => console.error("No se pudo registrar el log de auditoría:", err.message));
    });
    next();
  };
}

module.exports = saveLog;
