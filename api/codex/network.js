const { Router } = require('express');
const router = Router();
const response = require('../../network/response');
const ctrl = require('./index');
const checkAuth = require('../../middleware/checkAuth');
const checkPermission = require('../../middleware/checkPermissions');
const saveLog = require('../../middleware/saveLog');

const USE = 'codex_use';

// Resuelve el actor (usuario de Bravo Hub) y ejecuta el handler; cualquier
// error sigue al middleware de errores de api/index.js.
const run = (fn) => async (req, res, next) => {
    try {
        const actor = await ctrl.getActor(req.user.email);
        await fn(req, res, actor);
    } catch (error) {
        next(error);
    }
};

const ok = (req, res, body) => response.success(req, res, body, 200);

// El autoguardado de bloques no se registra en logs; solo el renombrar.
const logRenombrar = saveLog(USE, {
    descripcion: (req) => `Renombró la página de CodeX "${req._logNombre || '—'}"`,
    entityId: (req) => req.params.id,
});
const siRenombra = (req, res, next) => (req.body?.nombre !== undefined ? logRenombrar(req, res, next) : next());

/**
 * @swagger
 * /codex/pages:
 *   get: { summary: Mis páginas de CodeX (sin bloques), tags: [CodeX] }
 *   post: { summary: Crear página (nombre y bloques opcionales), tags: [CodeX] }
 * /codex/pages/{id}:
 *   get: { summary: Página con sus bloques, tags: [CodeX] }
 *   put: { summary: Guardar bloques y/o nombre, tags: [CodeX] }
 *   delete: { summary: Borrar página, tags: [CodeX] }
 * /codex/pages/{id}/duplicar:
 *   post: { summary: Duplicar página, tags: [CodeX] }
 */
router.get('/pages', checkAuth, checkPermission(USE), run(async (req, res, actor) => {
    ok(req, res, await ctrl.listPaginas(actor));
}));

router.post('/pages', checkAuth, checkPermission(USE), saveLog(USE, {
    descripcion: (req) => `Creó la página de CodeX "${req._logNombre || '—'}"`,
    entityId: (req) => req._logId,
}), run(async (req, res, actor) => {
    const p = await ctrl.createPagina(actor, req.body || {});
    req._logNombre = p.nombre;
    req._logId = p.id;
    ok(req, res, p);
}));

router.get('/pages/:id', checkAuth, checkPermission(USE), run(async (req, res, actor) => {
    ok(req, res, await ctrl.getPagina(actor, req.params.id));
}));

router.put('/pages/:id', checkAuth, checkPermission(USE), siRenombra, run(async (req, res, actor) => {
    const p = await ctrl.updatePagina(actor, req.params.id, req.body || {});
    req._logNombre = p.nombre;
    ok(req, res, p);
}));

router.post('/pages/:id/duplicar', checkAuth, checkPermission(USE), saveLog(USE, {
    descripcion: (req) => `Duplicó la página de CodeX "${req._logNombre || '—'}"`,
    entityId: (req) => req._logId,
}), run(async (req, res, actor) => {
    const p = await ctrl.duplicarPagina(actor, req.params.id);
    req._logNombre = p.nombre;
    req._logId = p.id;
    ok(req, res, p);
}));

router.delete('/pages/:id', checkAuth, checkPermission(USE), saveLog(USE, {
    descripcion: (req) => `Borró la página de CodeX "${req._logNombre || '—'}"`,
    entityId: (req) => req.params.id,
}), run(async (req, res, actor) => {
    const p = await ctrl.deletePagina(actor, req.params.id);
    req._logNombre = p.nombre;
    ok(req, res, p);
}));

module.exports = router;
