// Pantalla pública del profesor (sin sesión): se identifica con documento +
// correo institucional en el body de cada petición (POST para que no queden en
// URLs ni logs de acceso). Con límite por IP para frenar intentos de adivinar.
const { Router } = require('express');
const rateLimit = require('express-rate-limit');
const router = Router();
const response = require('../../network/response');
const ctrl = require('./index');

const limiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: true, status: 429, body: 'Demasiados intentos, espera unos minutos e intenta de nuevo' },
});

const run = (fn) => async (req, res, next) => {
    try {
        response.success(req, res, await fn(req.body || {}), 200);
    } catch (error) {
        next(error);
    }
};

/**
 * @swagger
 * /asignia-publico/consultar:
 *   post:
 *     summary: Cursos asignados y postulaciones del profesor (periodo más reciente)
 *     tags: [AsigniaPublico]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema: { type: object, properties: { documento: { type: string }, correo: { type: string } } }
 * /asignia-publico/aceptar:
 *   post: { summary: "Aceptar cursos asignados ({ documento, correo, ids })", tags: [AsigniaPublico] }
 * /asignia-publico/rechazar:
 *   post: { summary: "Rechazar cursos asignados ({ documento, correo, ids, motivo })", tags: [AsigniaPublico] }
 * /asignia-publico/disponibles:
 *   post: { summary: Cursos vacíos del periodo a los que se puede postular, tags: [AsigniaPublico] }
 * /asignia-publico/postular:
 *   post: { summary: "Postularse a cursos vacíos ({ documento, correo, ids, nombre })", tags: [AsigniaPublico] }
 */
router.post('/consultar', limiter, run((b) => ctrl.consultar(b)));
router.post('/aceptar', limiter, run((b) => ctrl.responder(b, 'aceptar')));
router.post('/rechazar', limiter, run((b) => ctrl.responder(b, 'rechazar')));
router.post('/disponibles', limiter, run((b) => ctrl.disponibles(b)));
router.post('/postular', limiter, run((b) => ctrl.postular(b)));

module.exports = router;
