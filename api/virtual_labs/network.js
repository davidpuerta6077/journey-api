const { Router } = require('express');
const router = Router();
const response = require('../../network/response');
const ctrl = require('./index');



/**
 * @swagger
 * /virtual_labs/labs_grades:
 *   get:
 *     summary: Registrar la calificación de un estudiante en un laboratorio virtual
 *     tags: [VirtualLabs]
 *     parameters:
 *       - in: query
 *         name: id_estudiante
 *         required: true
 *         schema: { type: integer }
 *       - in: query
 *         name: correo
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: id_curso
 *         required: true
 *         schema: { type: integer }
 *       - in: query
 *         name: calificacion
 *         required: true
 *         schema: { type: number, format: double }
 *     responses:
 *       200: { description: Calificación registrada }
 *       400: { description: Faltan parámetros requeridos }
 */
router.get('/labs_grades', async (req, res) => {
    try {
        const { id_estudiante, correo, id_curso, calificacion } = req.query;
        if (!id_estudiante || !correo || !id_curso || calificacion === undefined) {
            return response.error(req, res, 'Faltan parámetros requeridos: id_estudiante, correo, id_curso, calificacion', 400);
        }
        const result = await ctrl.addLabGrade({ id_estudiante, correo, id_curso, calificacion });
        response.success(req, res, result, 200);
    } catch (error) {
        response.error(req, res, error.message, 500);
    }
});

/**
 * @swagger
 * /virtual_labs/labs_grades/list:
 *   get:
 *     summary: Listar las calificaciones registradas de laboratorios virtuales
 *     tags: [VirtualLabs]
 *     responses:
 *       200: { description: Lista de calificaciones }
 */
router.get('/labs_grades/list', async (req, res) => {
    try {
        const result = await ctrl.listLabsGrades();
        response.success(req, res, result, 200);
    } catch (error) {
        response.error(req, res, error.message, 500);
    }
});

module.exports = router;
