const { Router } = require('express');
const router = Router();
const response = require('../../network/response');
const ctrl = require('./index');
const checkAuth = require('../../middleware/checkAuth');
const checkPermission = require('../../middleware/checkPermissions');

/**
 * @swagger
 * /statistics:
 *   get:
 *     summary: Estadísticas generales o de una aplicación (Nexo, Onix-IA, Acudex, Atom, C0deX)
 *     tags: [Statistics]
 *     parameters:
 *       - in: query
 *         name: app
 *         schema: { type: string, enum: [general, nexo, onix, acudex, atom, codex] }
 *       - in: query
 *         name: dias
 *         schema: { type: integer, enum: [7, 30, 90, 180, 365] }
 *     responses:
 *       200: { description: Cifras, gráficos y listas de la aplicación }
 *       400: { description: app o dias no soportados }
 */
// Solo lectura: no se audita (se consulta cada vez que se cambia de pestaña o periodo).
router.get('/', checkAuth, checkPermission('statistics'), async (req, res, next) => {
    try {
        const result = await ctrl.estadisticas(req.query.app || 'general', req.query.dias || 30);
        response.success(req, res, result, 200);
    } catch (error) {
        next(error);
    }
});

module.exports = router;
