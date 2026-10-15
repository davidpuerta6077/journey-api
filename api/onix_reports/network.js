const { Router } = require('express');
const rateLimit = require('express-rate-limit');
const router = Router();
const response = require('../../network/response');
const ctrl = require('./index');
const checkAuth = require('../../middleware/checkAuth');
const checkPermission = require('../../middleware/checkPermissions');
const saveLog = require('../../middleware/saveLog');
const { nombreMes } = require('../../services/onix/word');

const USE = 'onix_reports_use';
const ADMIN = 'onix_reports_admin';

// La IA cuesta (Claude) o carga un servidor compartido (Ollama): máximo 60
// generaciones (una por subactividad) por usuario por hora.
const generarLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 60,
    keyGenerator: (req) => req.user.email,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: true, status: 429, body: 'Alcanzaste el límite de 60 generaciones por hora, intenta más tarde' },
});

// Resuelve el actor (usuario de Bravo Hub + permisos) y ejecuta el handler;
// cualquier error sigue al middleware de errores de api/index.js.
const run = (fn) => async (req, res, next) => {
    try {
        const actor = await ctrl.getActor(req.user.email);
        await fn(req, res, actor);
    } catch (error) {
        next(error);
    }
};

const ok = (req, res, body) => response.success(req, res, body, 200);

// Los títulos llevan tildes y guiones largos: filename ASCII de respaldo y
// filename* (RFC 5987) con el nombre real.
function enviarArchivo(res, { buffer, filename }) {
    const ascii = filename.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\x20-\x7e]/g, '_').replace(/"/g, '');
    res.setHeader('Content-Type', filename.endsWith('.zip')
        ? 'application/zip'
        : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`);
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
    res.send(buffer);
}

const periodo = (o) => `${nombreMes(Number(o?.mes)) || o?.mes} de ${o?.anio}`;

/**
 * @swagger
 * /onix/perfil:
 *   get: { summary: Mi perfil de informes (nombre, identificación, área, contrato, objeto), tags: [OnixReports] }
 *   put: { summary: Guardar mi perfil de informes, tags: [OnixReports] }
 */
router.get('/perfil', checkAuth, checkPermission(USE), run(async (req, res, actor) => {
    ok(req, res, await ctrl.getPerfil(actor));
}));

router.put('/perfil', checkAuth, checkPermission(USE), saveLog(USE, {
    descripcion: () => 'Actualizó su perfil de informes',
}), run(async (req, res, actor) => {
    ok(req, res, await ctrl.savePerfil(actor, req.body || {}));
}));

/**
 * @swagger
 * /onix/areas:
 *   get: { summary: Listar áreas, tags: [OnixReports] }
 *   post: { summary: Crear área (admin), tags: [OnixReports] }
 * /onix/areas/{id}:
 *   put: { summary: Editar área (admin), tags: [OnixReports] }
 *   delete: { summary: Eliminar área (admin), tags: [OnixReports] }
 */
router.get('/areas', checkAuth, checkPermission(USE), run(async (req, res) => {
    ok(req, res, await ctrl.listAreas());
}));

router.post('/areas', checkAuth, checkPermission(ADMIN), saveLog(ADMIN, {
    descripcion: (req) => `Creó el área "${req._logArea || '—'}"`,
    entityId: (req) => req._logAreaId,
}), run(async (req, res) => {
    const area = await ctrl.createArea(req.body || {});
    req._logArea = area.nombre;
    req._logAreaId = area.id;
    ok(req, res, area);
}));

router.put('/areas/:id', checkAuth, checkPermission(ADMIN), saveLog(ADMIN, {
    descripcion: (req) => `Editó el área "${req._logArea || '—'}"`,
    entityId: (req) => req.params.id,
}), run(async (req, res) => {
    const area = await ctrl.updateArea(req.params.id, req.body || {});
    req._logArea = area.nombre;
    ok(req, res, area);
}));

router.delete('/areas/:id', checkAuth, checkPermission(ADMIN), saveLog(ADMIN, {
    descripcion: (req) => `Eliminó el área "${req._logArea || '—'}"`,
    entityId: (req) => req.params.id,
}), run(async (req, res) => {
    const area = await ctrl.deleteArea(req.params.id);
    req._logArea = area.nombre;
    ok(req, res, area);
}));

/**
 * @swagger
 * /onix/actividades:
 *   get: { summary: Listar actividades (propias o de user_id si tiene acceso), tags: [OnixReports] }
 *   post: { summary: Crear actividad, tags: [OnixReports] }
 * /onix/actividades/{id}:
 *   put: { summary: Editar actividad propia, tags: [OnixReports] }
 *   delete: { summary: Eliminar actividad propia con sus registros y evidencias, tags: [OnixReports] }
 * /onix/actividades/{id}/evidencias-word:
 *   get: { summary: Descargar Word de evidencias del mes (mes, anio), tags: [OnixReports] }
 */
router.get('/actividades', checkAuth, checkPermission(USE), run(async (req, res, actor) => {
    ok(req, res, await ctrl.listActividades(actor, req.query.user_id));
}));

router.post('/actividades', checkAuth, checkPermission(USE), saveLog(USE, {
    descripcion: (req) => `Creó la actividad "${req._logActividad || '—'}"`,
    entityId: (req) => req._logActividadId,
}), run(async (req, res, actor) => {
    const act = await ctrl.createActividad(actor, req.body || {});
    req._logActividad = act.nombre;
    req._logActividadId = act.id;
    ok(req, res, act);
}));

router.put('/actividades/:id', checkAuth, checkPermission(USE), saveLog(USE, {
    descripcion: (req) => `Editó la actividad "${req._logActividad || '—'}"`,
    entityId: (req) => req.params.id,
}), run(async (req, res, actor) => {
    const act = await ctrl.updateActividad(actor, req.params.id, req.body || {});
    req._logActividad = act.nombre;
    ok(req, res, act);
}));

router.delete('/actividades/:id', checkAuth, checkPermission(USE), saveLog(USE, {
    descripcion: (req) => `Eliminó la actividad "${req._logActividad || '—'}"`,
    entityId: (req) => req.params.id,
}), run(async (req, res, actor) => {
    const act = await ctrl.deleteActividad(actor, req.params.id);
    req._logActividad = act.nombre;
    ok(req, res, act);
}));

/**
 * @swagger
 * /onix/actividades/{id}/documento-word:
 *   get: { summary: Documento de la actividad del mes (Evidencia_<Mes>_actividad_<N>.docx; mes, anio), tags: [OnixReports] }
 * /onix/zip:
 *   get: { summary: Zip del mes con la estructura de Drive (mes, anio, user_id opcional), tags: [OnixReports] }
 */
router.get('/actividades/:id/documento-word', checkAuth, checkPermission(USE), run(async (req, res, actor) => {
    enviarArchivo(res, await ctrl.documentoActividadWord(actor, req.params.id, req.query));
}));

router.get('/zip', checkAuth, checkPermission(USE), run(async (req, res, actor) => {
    enviarArchivo(res, await ctrl.zipMes(actor, req.query));
}));

/**
 * @swagger
 * /onix/registros:
 *   get: { summary: Subactividades del mes con evidencias (mes, anio; actividad_id o user_id opcionales), tags: [OnixReports] }
 *   post: { summary: Crear subactividad (actividad_id, mes, anio, titulo, desarrollo), tags: [OnixReports] }
 * /onix/registros/{id}:
 *   put: { summary: Editar subactividad propia (desarrollo; titulo y parrafo opcionales), tags: [OnixReports] }
 *   delete: { summary: Eliminar subactividad propia con sus evidencias, tags: [OnixReports] }
 * /onix/registros/{id}/generar:
 *   post: { summary: Generar con IA el párrafo y el documento de evidencia de una subactividad, tags: [OnixReports] }
 * /onix/registros/{id}/word:
 *   get: { summary: Documento de evidencia de una subactividad, tags: [OnixReports] }
 */
router.get('/registros', checkAuth, checkPermission(USE), run(async (req, res, actor) => {
    ok(req, res, await ctrl.listRegistros(actor, req.query));
}));

router.post('/registros/:id/generar', checkAuth, checkPermission(USE), generarLimiter, saveLog(USE, {
    descripcion: (req) => `Generó con IA la subactividad "${req._logTitulo || '—'}" de "${req._logActividad || '—'}"`,
    entityId: (req) => req.params.id,
    detalle: (req) => (req._logProveedor ? { proveedor: req._logProveedor, modelo: req._logModelo } : null),
}), run(async (req, res, actor) => {
    const r = await ctrl.generarSubactividad(actor, req.params.id);
    req._logTitulo = r.titulo;
    req._logActividad = r.actividad_nombre;
    req._logProveedor = r.proveedor;
    req._logModelo = r.modelo;
    ok(req, res, r);
}));

router.get('/registros/:id/word', checkAuth, checkPermission(USE), run(async (req, res, actor) => {
    enviarArchivo(res, await ctrl.subactividadWord(actor, req.params.id));
}));

router.post('/registros', checkAuth, checkPermission(USE), saveLog(USE, {
    descripcion: (req) => `Agregó la subactividad "${req._logTitulo || '—'}" a "${req._logActividad || '—'}" (${periodo(req.body)})`,
    entityId: (req) => req._logRegistroId,
}), run(async (req, res, actor) => {
    const r = await ctrl.createRegistro(actor, req.body || {});
    req._logTitulo = r.titulo;
    req._logActividad = r.actividad_nombre;
    req._logRegistroId = r.id;
    ok(req, res, r);
}));

router.put('/registros/:id', checkAuth, checkPermission(USE), saveLog(USE, {
    descripcion: (req) => `Editó un registro (${req._logPeriodo || '—'})`,
    entityId: (req) => req.params.id,
}), run(async (req, res, actor) => {
    const r = await ctrl.updateRegistro(actor, req.params.id, req.body || {});
    req._logPeriodo = periodo(r);
    ok(req, res, r);
}));

router.delete('/registros/:id', checkAuth, checkPermission(USE), saveLog(USE, {
    descripcion: (req) => `Eliminó un registro (${req._logPeriodo || '—'})`,
    entityId: (req) => req.params.id,
}), run(async (req, res, actor) => {
    const r = await ctrl.deleteRegistro(actor, req.params.id);
    req._logPeriodo = periodo(r);
    ok(req, res, r);
}));

/**
 * @swagger
 * /onix/logs:
 *   get: { summary: Mis acciones del mes en Bravo Hub aún no asignadas a un registro (mes, anio), tags: [OnixReports] }
 * /onix/registros/desde-logs:
 *   post: { summary: Crear un registro que agrupa acciones propias de Bravo Hub (actividad_id, mes, anio, log_ids), tags: [OnixReports] }
 */
router.get('/logs', checkAuth, checkPermission(USE), run(async (req, res, actor) => {
    ok(req, res, await ctrl.listLogsDisponibles(actor, req.query));
}));

router.post('/registros/desde-logs', checkAuth, checkPermission(USE), saveLog(USE, {
    descripcion: (req) => `Agregó un registro desde ${req._logCantidad || 0} acción(es) de Bravo Hub a "${req._logActividad || '—'}" (${periodo(req.body)})`,
    entityId: (req) => req._logRegistroId,
    detalle: (req) => (req._logIds ? { log_ids: req._logIds } : null),
}), run(async (req, res, actor) => {
    const r = await ctrl.registroDesdeLogs(actor, req.body || {});
    req._logActividad = r.actividad_nombre;
    req._logRegistroId = r.id;
    req._logCantidad = r.logs;
    req._logIds = req.body.log_ids;
    ok(req, res, r);
}));

/**
 * @swagger
 * /onix/evidencias:
 *   post: { summary: Agregar evidencia (texto, link o imagen en campo multipart "archivo"), tags: [OnixReports] }
 * /onix/evidencias/{id}:
 *   put: { summary: Editar la descripción (pie) de una evidencia propia, tags: [OnixReports] }
 *   delete: { summary: Eliminar evidencia propia, tags: [OnixReports] }
 * /onix/evidencias/{id}/archivo:
 *   get: { summary: Ver la imagen de una evidencia (con control de acceso), tags: [OnixReports] }
 */
router.post('/evidencias', checkAuth, checkPermission(USE), saveLog(USE, {
    descripcion: (req) => `Agregó una evidencia (${req._logTipo || '—'})`,
    entityId: (req) => req._logEvidenciaId,
}), run(async (req, res, actor) => {
    const ev = await ctrl.addEvidencia(actor, req.body || {}, req.files?.archivo || null);
    req._logTipo = ev.tipo;
    req._logEvidenciaId = ev.id;
    ok(req, res, ev);
}));

router.put('/evidencias/:id', checkAuth, checkPermission(USE), saveLog(USE, {
    descripcion: () => 'Editó la descripción de una evidencia',
    entityId: (req) => req.params.id,
}), run(async (req, res, actor) => {
    ok(req, res, await ctrl.updateEvidencia(actor, req.params.id, req.body || {}));
}));

router.delete('/evidencias/:id', checkAuth, checkPermission(USE), saveLog(USE, {
    descripcion: (req) => `Eliminó una evidencia (${req._logTipo || '—'})`,
    entityId: (req) => req.params.id,
}), run(async (req, res, actor) => {
    const ev = await ctrl.deleteEvidencia(actor, req.params.id);
    req._logTipo = ev.tipo;
    ok(req, res, ev);
}));

router.get('/evidencias/:id/archivo', checkAuth, checkPermission(USE), run(async (req, res, actor) => {
    const { datos, mime } = await ctrl.getEvidenciaArchivo(actor, req.params.id);
    res.setHeader('Content-Type', mime);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.send(datos);
}));

/**
 * @swagger
 * /onix/area/usuarios:
 *   get: { summary: Usuarios de mi área (o todos si admin) con subactividades y generadas del mes, tags: [OnixReports] }
 */
router.get('/area/usuarios', checkAuth, checkPermission(USE), run(async (req, res, actor) => {
    ok(req, res, await ctrl.listUsuariosArea(actor, req.query));
}));

module.exports = router;
