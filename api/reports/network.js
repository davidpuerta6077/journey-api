const { Router } = require('express');
const router = Router();
const response = require('../../network/response');
const ctrl = require('./index');
const checkAuth = require('../../middleware/checkAuth');
const checkPermission = require('../../middleware/checkPermissions');
const saveLog = require('../../middleware/saveLog');
const TIPOS = require('../../services/reports/tipos');

const PERM = 'reports';

// Nombre legible de un tipo de reporte para la auditoría (cae al código si no está).
const labelTipo = (tipo) => (TIPOS.find((t) => t.tipo === tipo) || {}).label || tipo || '—';

/**
 * @swagger
 * tags:
 *   name: Reports
 *   description: Módulo de Reportes (definiciones guardadas + ejecución)
 */

/**
 * @swagger
 * /reports/tipos:
 *   get:
 *     summary: Catálogo de tipos de reporte disponibles
 *     tags: [Reports]
 *     responses:
 *       200: { description: Lista de tipos con su schema de parámetros }
 */
router.get('/tipos', checkAuth, checkPermission(PERM), async (req, res, next) => {
    try {
        response.success(req, res, ctrl.tiposDisponibles(), 200);
    } catch (error) {
        next(error);
    }
});

/**
 * @swagger
 * /reports/run:
 *   post:
 *     summary: Ejecutar un reporte ad-hoc (sin guardarlo)
 *     tags: [Reports]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [tipo]
 *             properties:
 *               tipo:   { type: string }
 *               params: { type: object }
 *     responses:
 *       200: { description: Resultado del reporte }
 *       400: { description: Tipo no soportado o faltan datos }
 */
// La previsualización no se audita: es una consulta de solo lectura que el
// usuario dispara varias veces mientras ajusta parámetros y solo inundaría
// la tabla `logs`. Se audita la creación (POST /), la edición y el borrado.
router.post('/run', checkAuth, checkPermission(PERM),
    async (req, res, next) => {
        try {
            const result = await ctrl.ejecutarAdHoc(req.body.tipo, req.body.params || {});
            response.success(req, res, result, 200);
        } catch (error) {
            next(error);
        }
    });

/**
 * @swagger
 * /reports:
 *   get:
 *     summary: Listar definiciones de reporte guardadas
 *     tags: [Reports]
 *     responses:
 *       200: { description: Lista de reportes }
 */
router.get('/', checkAuth, checkPermission(PERM), async (req, res, next) => {
    try {
        const result = await ctrl.listReportes();
        response.success(req, res, result, 200);
    } catch (error) {
        next(error);
    }
});

/**
 * @swagger
 * /reports/{id}:
 *   get:
 *     summary: Obtener una definición de reporte
 *     tags: [Reports]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Definición del reporte }
 *       404: { description: Reporte no encontrado }
 */
router.get('/:id', checkAuth, checkPermission(PERM), async (req, res, next) => {
    try {
        const result = await ctrl.getReporte(req.params.id);
        response.success(req, res, result, 200);
    } catch (error) {
        next(error);
    }
});

/**
 * @swagger
 * /reports/{id}/run:
 *   get:
 *     summary: Ejecutar un reporte guardado
 *     tags: [Reports]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Resultado del reporte }
 *       404: { description: Reporte no encontrado }
 */
// No se audita: la vista de detalle ejecuta este GET automáticamente al montar
// y en cada "Re-ejecutar", con lo que una sola visita generaría varias filas
// en `logs`. La ejecución de un reporte guardado es idempotente y de solo
// lectura, así que no aporta a la auditoría.
router.get('/:id/run', checkAuth, checkPermission(PERM),
    async (req, res, next) => {
        try {
            const result = await ctrl.ejecutarReporte(req.params.id);
            response.success(req, res, result, 200);
        } catch (error) {
            next(error);
        }
    });

/**
 * @swagger
 * /reports:
 *   post:
 *     summary: Crear una definición de reporte
 *     tags: [Reports]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [nombre, tipo]
 *             properties:
 *               nombre:      { type: string }
 *               tipo:        { type: string }
 *               descripcion: { type: string }
 *               params:      { type: object }
 *     responses:
 *       200: { description: Reporte creado }
 *       400: { description: Faltan datos o tipo no soportado }
 */
router.post('/', checkAuth, checkPermission(PERM),
    saveLog(PERM, { descripcion: (req) => `Creó el reporte "${req.body?.nombre || '—'}" (${labelTipo(req.body?.tipo)})` }),
    async (req, res, next) => {
        try {
            const result = await ctrl.createReporte(req.body, req.user.email);
            response.success(req, res, result, 200);
        } catch (error) {
            next(error);
        }
    });

/**
 * @swagger
 * /reports/{id}:
 *   put:
 *     summary: Editar una definición de reporte
 *     tags: [Reports]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nombre:      { type: string }
 *               descripcion: { type: string }
 *               params:      { type: object }
 *     responses:
 *       200: { description: Reporte actualizado }
 *       404: { description: Reporte no encontrado }
 */
router.put('/:id', checkAuth, checkPermission(PERM),
    saveLog(PERM, {
        entityId: (req) => req.params.id,
        descripcion: (req) => `Editó el reporte "${req.reporteNombre || ('#' + req.params.id)}"`,
    }),
    async (req, res, next) => {
        try {
            const result = await ctrl.updateReporte(req.params.id, req.body);
            req.reporteNombre = result?.nombre;
            response.success(req, res, result, 200);
        } catch (error) {
            next(error);
        }
    });

/**
 * @swagger
 * /reports/{id}:
 *   delete:
 *     summary: Eliminar una definición de reporte
 *     tags: [Reports]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Reporte eliminado }
 *       404: { description: Reporte no encontrado }
 */
router.delete('/:id', checkAuth, checkPermission(PERM),
    saveLog(PERM, {
        entityId: (req) => req.params.id,
        descripcion: (req) => `Eliminó el reporte "${req.reporteNombre || ('#' + req.params.id)}"`,
    }),
    async (req, res, next) => {
        try {
            const result = await ctrl.deleteReporte(req.params.id);
            req.reporteNombre = result?.nombre;
            response.success(req, res, result, 200);
        } catch (error) {
            next(error);
        }
    });

module.exports = router;
