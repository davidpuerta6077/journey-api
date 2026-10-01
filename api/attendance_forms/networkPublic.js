const { Router } = require('express');
const rateLimit = require('express-rate-limit');
const router = Router();
const response = require('../../network/response');
const ctrl = require('./index');

// Hasta 5 registros por IP cada 10 minutos: suficiente para una persona que
// se equivoca y reintenta, insuficiente para un bot llenando el formulario.
const submitLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: true, status: 429, body: 'Demasiados intentos, espera unos minutos e intenta de nuevo' },
});

/**
 * @swagger
 * /f/{publicToken}:
 *   get:
 *     summary: Obtener la estructura pública de un formulario (sin sesión)
 *     tags: [AttendanceFormsPublic]
 *     parameters:
 *       - in: path
 *         name: publicToken
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Estructura del formulario, o motivo por el que no está disponible }
 *       404: { description: Link inválido }
 */
router.get('/:publicToken', async (req, res, next) => {
    try {
        const result = await ctrl.getPublicForm(req.params.publicToken);
        response.success(req, res, result, 200);
    } catch (error) {
        next(error);
    }
});

/**
 * @swagger
 * /f/{publicToken}/responses:
 *   post:
 *     summary: Enviar un registro de asistencia (sin sesión)
 *     tags: [AttendanceFormsPublic]
 *     parameters:
 *       - in: path
 *         name: publicToken
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Registro guardado }
 *       409: { description: Formulario cerrado, vencido, con cupo lleno, o ya registrado }
 */
router.post('/:publicToken/responses', submitLimiter, async (req, res, next) => {
    try {
        const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress;
        const result = await ctrl.submitPublicResponse(req.params.publicToken, req.body, ip);
        response.success(req, res, result, 200);
    } catch (error) {
        next(error);
    }
});

module.exports = router;
