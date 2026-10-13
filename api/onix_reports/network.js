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

// La IA cuesta (Claude) o carga un servidor compartido (Ollama): máximo 20
// generaciones por usuario por hora.
const generarLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 20,
    keyGenerator: (req) => req.user.email,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: true, status: 429, body: 'Alcanzaste el límite de 20 generaciones por hora, intenta más tarde' },
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

function enviarArchivo(res, { buffer, filename }) {
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
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

router.get('/actividades/:id/evidencias-word', checkAuth, checkPermission(USE), run(async (req, res, actor) => {
    enviarArchivo(res, await ctrl.evidenciasWord(actor, req.params.id, req.query));
}));

/**
 * @swagger
 * /onix/registros:
 *   get: { summary: Registros de una actividad en un mes (actividad_id, mes, anio) con evidencias, tags: [OnixReports] }
 *   post: { summary: Crear registro, tags: [OnixReports] }
 * /onix/registros/{id}:
 *   put: { summary: Editar registro propio, tags: [OnixReports] }
 *   delete: { summary: Eliminar registro propio con sus evidencias, tags: [OnixReports] }
 */
router.get('/registros', checkAuth, checkPermission(USE), run(async (req, res, actor) => {
    ok(req, res, await ctrl.listRegistros(actor, req.query));
}));

router.post('/registros', checkAuth, checkPermission(USE), saveLog(USE, {
    descripcion: (req) => `Agregó un registro a "${req._logActividad || '—'}" (${periodo(req.body)})`,
    entityId: (req) => req._logRegistroId,
}), run(async (req, res, actor) => {
    const r = await ctrl.createRegistro(actor, req.body || {});
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
 * /onix/informes:
 *   get: { summary: Informes del mes (mes, anio, user_id opcional), tags: [OnixReports] }
 * /onix/informes/generar:
 *   post: { summary: Redactar con IA el desarrollo de una actividad del mes, tags: [OnixReports] }
 * /onix/informes/{id}:
 *   put: { summary: Editar el texto de un informe propio, tags: [OnixReports] }
 * /onix/informes/{id}/word:
 *   get: { summary: Descargar el informe en Word, tags: [OnixReports] }
 * /onix/area/usuarios:
 *   get: { summary: Usuarios de mi área (o todos si admin) con conteos del mes, tags: [OnixReports] }
 */
router.get('/informes', checkAuth, checkPermission(USE), run(async (req, res, actor) => {
    ok(req, res, await ctrl.listInformes(actor, req.query));
}));

router.post('/informes/generar', checkAuth, checkPermission(USE), generarLimiter, saveLog(USE, {
    descripcion: (req) => `Generó con IA el informe de "${req._logActividad || '—'}" (${periodo(req.body)})`,
    entityId: (req) => req._logInformeId,
    detalle: (req) => (req._logProveedor ? { proveedor: req._logProveedor, modelo: req._logModelo } : null),
}), run(async (req, res, actor) => {
    const inf = await ctrl.generarInforme(actor, req.body || {});
    req._logActividad = inf.actividad_nombre;
    req._logInformeId = inf.id;
    req._logProveedor = inf.proveedor;
    req._logModelo = inf.modelo;
    ok(req, res, inf);
}));

router.put('/informes/:id', checkAuth, checkPermission(USE), saveLog(USE, {
    descripcion: (req) => `Editó el informe de "${req._logActividad || '—'}"`,
    entityId: (req) => req.params.id,
}), run(async (req, res, actor) => {
    const inf = await ctrl.updateInforme(actor, req.params.id, req.body || {});
    req._logActividad = inf.actividad_nombre;
    ok(req, res, inf);
}));

router.get('/informes/:id/word', checkAuth, checkPermission(USE), run(async (req, res, actor) => {
    enviarArchivo(res, await ctrl.informeWord(actor, req.params.id));
}));

router.get('/area/usuarios', checkAuth, checkPermission(USE), run(async (req, res, actor) => {
    ok(req, res, await ctrl.listUsuariosArea(actor, req.query));
}));

module.exports = router;
