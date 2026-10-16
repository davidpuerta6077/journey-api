const { Router } = require('express');
const router = Router();
const response = require('../../network/response');
const ctrl = require('./index');
const checkAuth = require('../../middleware/checkAuth');

// Datos personales del usuario logueado (sus propias notificaciones, filtradas
// por su platform_user_id): no van gateadas por checkPermission/saveLog como
// el resto de módulos -no hay un submódulo que las represente y marcar como
// leída no es una acción auditable-, igual que /admin/menu-links/active.

/**
 * @swagger
 * /notifications:
 *   get:
 *     summary: Listar mis notificaciones (más recientes primero)
 *     tags: [Notifications]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 30 }
 *     responses:
 *       200: { description: Lista de notificaciones con su estado leído/no leído }
 */
router.get('/', checkAuth, async (req, res, next) => {
    try {
        const limit = Math.min(Number(req.query.limit) || 30, 100);
        const result = await ctrl.listMine(req.user.email, limit);
        response.success(req, res, result, 200);
    } catch (error) {
        next(error);
    }
});

/**
 * @swagger
 * /notifications/unread-count:
 *   get:
 *     summary: Cantidad de notificaciones no leídas del usuario logueado
 *     tags: [Notifications]
 *     responses:
 *       200: { description: Conteo de no leídas }
 */
router.get('/unread-count', checkAuth, async (req, res, next) => {
    try {
        const result = await ctrl.countUnread(req.user.email);
        response.success(req, res, { count: result }, 200);
    } catch (error) {
        next(error);
    }
});

/**
 * @swagger
 * /notifications/{id}/read:
 *   post:
 *     summary: Marcar una notificación como leída
 *     tags: [Notifications]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Notificación marcada como leída }
 */
router.post('/:id/read', checkAuth, async (req, res, next) => {
    try {
        const result = await ctrl.markRead(req.user.email, req.params.id);
        response.success(req, res, result, 200);
    } catch (error) {
        next(error);
    }
});

/**
 * @swagger
 * /notifications/read-all:
 *   post:
 *     summary: Marcar todas mis notificaciones como leídas
 *     tags: [Notifications]
 *     responses:
 *       200: { description: Notificaciones marcadas como leídas }
 */
router.post('/read-all', checkAuth, async (req, res, next) => {
    try {
        await ctrl.markAllRead(req.user.email);
        response.success(req, res, { ok: true }, 200);
    } catch (error) {
        next(error);
    }
});

module.exports = router;
