const { Router } = require('express');
const router = Router();
const response = require('../../network/response');
const ctrl = require('./index');
const checkAuth = require('../../middleware/checkAuth');
const checkPermission = require('../../middleware/checkPermissions');
const saveLog = require('../../middleware/saveLog');

const USE = 'atom_use';
const ASSIGN = 'atom_assign';
const ADMIN = 'atom_admin';

// Resuelve el actor (usuario de Bravo Hub) y ejecuta el handler; cualquier
// error sigue al middleware de errores de api/index.js. Mismo patrón que
// api/codex/network.js.
const run = (fn) => async (req, res, next) => {
    try {
        const actor = await ctrl.getActor(req.user.email);
        await fn(req, res, actor);
    } catch (error) {
        next(error);
    }
};

const ok = (req, res, body) => response.success(req, res, body, 200);

const boolParam = (v) => v === '1' || v === 'true';

function filtrosDeQuery(q) {
    return {
        estado:    q.estado || null,
        prioridad: q.prioridad || null,
        asignadoA: q.asignado_a ? Number(q.asignado_a) : null,
        creadoPor: q.creado_por ? Number(q.creado_por) : null,
        q:         q.q || null,
        desde:     q.desde || null,
        hasta:     q.hasta || null,
        hoy:       boolParam(q.hoy),
        vencidas:  boolParam(q.vencidas),
        todas:     boolParam(q.todas),
    };
}

/**
 * @swagger
 * /atom/tasks:
 *   get:
 *     summary: Mis tareas (creadas por mí o asignadas a mí) con filtros
 *     tags: [Atom]
 *     parameters:
 *       - { in: query, name: estado, schema: { type: string } }
 *       - { in: query, name: prioridad, schema: { type: string } }
 *       - { in: query, name: asignado_a, schema: { type: integer } }
 *       - { in: query, name: creado_por, schema: { type: integer } }
 *       - { in: query, name: q, schema: { type: string }, description: Búsqueda por título }
 *       - { in: query, name: desde, schema: { type: string, format: date } }
 *       - { in: query, name: hasta, schema: { type: string, format: date } }
 *       - { in: query, name: hoy, schema: { type: boolean } }
 *       - { in: query, name: vencidas, schema: { type: boolean } }
 *       - { in: query, name: todas, schema: { type: boolean }, description: Solo con atom_admin — ignora el filtro propio/asignado }
 *     responses:
 *       200: { description: "{ tasks: [...], counts: { pendientes, vencidas, completadas } }" }
 *   post:
 *     summary: Crear tarea (el creador siempre es el usuario autenticado)
 *     tags: [Atom]
 * /atom/tasks/{id}:
 *   get: { summary: Detalle de una tarea (con subtareas, comentarios e historial), tags: [Atom] }
 *   put: { summary: Editar una tarea, tags: [Atom] }
 * /atom/tasks/{id}/comentarios:
 *   post: { summary: Agregar un comentario, tags: [Atom] }
 * /atom/tasks/{id}/subtareas/{subtaskId}:
 *   post: { summary: Marcar/desmarcar una subtarea, tags: [Atom] }
 * /atom/tasks/bulk/estado:
 *   post: { summary: Cambiar el estado de varias tareas a la vez, tags: [Atom] }
 * /atom/usuarios:
 *   get: { summary: Buscar compañeros para asignarles una tarea (requiere atom_assign), tags: [Atom] }
 * /atom/stats:
 *   get: { summary: Estadísticas globales de Atom (requiere atom_admin), tags: [Atom] }
 */
router.get('/tasks', checkAuth, checkPermission(USE), run(async (req, res, actor) => {
    ok(req, res, await ctrl.listTasks(actor, filtrosDeQuery(req.query)));
}));

router.post('/tasks', checkAuth, checkPermission(USE), saveLog(USE, {
    descripcion: (req) => `Creó la tarea "${req._logTitulo || '—'}" en Atom`,
    entityId: (req) => req._logId,
}), run(async (req, res, actor) => {
    const t = await ctrl.createTask(actor, req.body || {});
    req._logTitulo = t.title; req._logId = t.id;
    ok(req, res, t);
}));

router.get('/tasks/:id', checkAuth, checkPermission(USE), run(async (req, res, actor) => {
    ok(req, res, await ctrl.getTaskDetalle(actor, req.params.id));
}));

router.put('/tasks/:id', checkAuth, checkPermission(USE), saveLog(USE, {
    descripcion: (req) => `Editó la tarea "${req._logTitulo || '—'}" en Atom`,
    entityId: (req) => req.params.id,
}), run(async (req, res, actor) => {
    const t = await ctrl.updateTask(actor, req.params.id, req.body || {});
    req._logTitulo = t.title;
    ok(req, res, t);
}));

router.post('/tasks/:id/comentarios', checkAuth, checkPermission(USE), saveLog(USE, {
    descripcion: (req) => `Comentó en una tarea de Atom`,
    entityId: (req) => req.params.id,
}), run(async (req, res, actor) => {
    ok(req, res, await ctrl.addComment(actor, req.params.id, req.body || {}));
}));

router.post('/tasks/:id/subtareas/:subtaskId', checkAuth, checkPermission(USE), run(async (req, res, actor) => {
    ok(req, res, await ctrl.toggleSubtask(actor, req.params.id, req.params.subtaskId, req.body?.done));
}));

router.post('/tasks/bulk/estado', checkAuth, checkPermission(USE), saveLog(USE, {
    descripcion: (req) => `Cambió el estado de ${Array.isArray(req.body?.ids) ? req.body.ids.length : 0} tarea(s) en Atom a "${req.body?.estado || '—'}"`,
    detalle: (req) => ({ ids: req.body?.ids, estado: req.body?.estado }),
}), run(async (req, res, actor) => {
    ok(req, res, await ctrl.bulkEstado(actor, req.body?.ids, req.body?.estado));
}));

router.get('/usuarios', checkAuth, checkPermission(ASSIGN), run(async (req, res, actor) => {
    void actor;
    ok(req, res, await ctrl.assignableUsers(req.query.q));
}));

router.get('/stats', checkAuth, checkPermission(ADMIN), run(async (req, res, actor) => {
    void actor;
    ok(req, res, await ctrl.statsGlobal());
}));

module.exports = router;
