const { Router } = require('express');
const router = Router();
const response = require('../../network/response');
const ctrl = require('./index');

const checkAuth = require('../../middleware/checkAuth');
const checkPermission = require('../../middleware/checkPermissions');


// ─── RUTAS DE PRUEBA DEL SISTEMA ─────────────────────────────────────────────────────────────────
/**
 * @swagger
 * /users/test:
 *   get:
 *     summary: Test de conexión a la base de datos
 *     tags: [Users]
 *     responses:
 *       200:
 *         description: API funcionando correctamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:  { type: boolean, example: false }
 *                 status: { type: integer, example: 200 }
 *                 body:
 *                   type: object
 *                   properties:
 *                     test_message: { type: string, example: "Api Users Working!" }
 *                     table:        { type: array, items: { type: object } }
 */
router.get('/test_api', async (req, res) => {
    try {
        response.success(req, res, { test_message: 'Api Working!'}, 200);
    } catch (error) {
        response.error(req, res, error.message, 500);
    }
});


router.get('/test_bd_conection', async (req, res) => {
    try {
        const data = await ctrl.healtBd();
        response.success(req, res, { test_message: 'BD Working!', data }, 200);
    } catch (error) {
        response.error(req, res, error.message, 500);
    }
});


router.get('/test_auth', checkAuth, async (req, res) => {
    try {
        response.success(req, res, { test_message: 'Api Working!'}, 200);
    } catch (error) {
        response.error(req, res, error.message, 500);
    }
});


router.get('/test_module_access', checkPermission('sync_users'), async (req, res) => {
    try {
        response.success(req, res, { test_message: 'Test de permiso para sync_users Working!'}, 200);
    } catch (error) {
        response.error(req, res, error.message, 500);
    }
});


router.get('/test_full_secure', checkAuth, checkPermission('sync_users'), async (req, res) => {
    try {
        response.success(req, res, { test_message: 'Test de permiso para sync_users Working!'}, 200);
    } catch (error) {
        response.error(req, res, error.message, 500);
    }
});

module.exports = router;