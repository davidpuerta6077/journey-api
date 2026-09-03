const { Router } = require('express');
const router = Router();
const response = require('../../network/response');
const ctrl = require('./index');
const { moodleRequest } = require('../../services/moodleService');
/**
 * @swagger
 * /sicau/get_users_sicau:
 *   get:
 *     summary: Listar usuarios de Moodle
 *     tags: [SICAU]
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Filtrar por apellido (% para todos)
 *         example: "García"
 *     responses:
 *       200:
 *         description: Lista de usuarios de Moodle
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:  { type: boolean, example: false }
 *                 status: { type: integer, example: 200 }
 *                 body:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/User'
 *       500:
 *         description: Error de Moodle
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/get_users_sicau', async (req, res) => {
    try {
        const result = await moodleRequest('core_user_get_users', {
            'criteria[0][key]':   'lastname',
            'criteria[0][value]': req.query.search || '%',
        });
        response.success(req, res, result.users || [], 200);
    } catch (error) {
        response.error(req, res, error.message, 500);
    }
});
/**
 * @swagger
 * /sicau/search_user_sicau:
 *   post:
 *     summary: Buscar usuario en Moodle por criterio
 *     tags: [SICAU]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [key, value]
 *             properties:
 *               key:   { type: string, example: "email", description: "Campo por el que buscar" }
 *               value: { type: string, example: "juan@correo.com" }
 *     responses:
 *       200:
 *         description: Resultados de búsqueda
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       500:
 *         description: Error de Moodle
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/search_user_sicau', async (req, res) => {
    try {
        const result = await moodleRequest('core_user_get_users', {
            'criteria[0][key]':   req.body.key,
            'criteria[0][value]': req.body.value,
        });
        response.success(req, res, result, 200);
    } catch (error) {
        response.error(req, res, error.message, 500);
    }
});

/**
 * @swagger
 * /sicau/send_users_sicau:
 *   post:
 *     summary: Guardar usuarios provenientes del sistema SICAU
 *     tags: [SICAU]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               users:
 *                 type: array
 *                 items:
 *                   $ref: '#/components/schemas/User'
 *     responses:
 *       200:
 *         description: Usuarios guardados
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
 *                     results: { type: array, items: { type: object } }
 *       500:
 *         description: Error interno
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/send_users_sicau', async (req, res, next) => {
    try {
        const items = req.body.users || req.body.items || req.body || [];
        const lista = Array.isArray(items) ? items : [items];
        const results = [];
        for (const user of lista) {
            const result = await ctrl.saveSicauUsuario(user);
            results.push(result);
        }
        response.success(req, res, { results }, 200);
    } catch (error) {
        next(error);
    }
});

/**
 * @swagger
 * /sicau/send_courses_sicau:
 *   post:
 *     summary: Guardar cursos provenientes del sistema SICAU
 *     tags: [SICAU]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               courses:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     codigo_asignatura: { type: string, example: "FB0010" }
 *                     nombre_asignatura: { type: string, example: "Álgebra Lineal" }
 *                     programa:          { type: string, example: "Fundamentación" }
 *                     periodo:           { type: string, example: "20261" }
 *                     grupo:             { type: string, example: "G101" }
 *                     docente:           { type: string, example: "Johana Ramirez" }
 *                     fecha_inicio:      { type: string, example: "2026-01-15" }
 *                     fecha_fin:         { type: string, example: "2026-06-15" }
 *     responses:
 *       200:
 *         description: Cursos guardados
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       500:
 *         description: Error interno
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/send_courses_sicau', async (req, res, next) => {
    try {
        const items = req.body.courses || req.body.items || req.body || [];
        const lista = Array.isArray(items) ? items : [items];
        const results = [];
        for (const course of lista) {
            const result = await ctrl.saveSicauCurso(course);
            results.push(result);
        }
        response.success(req, res, { results }, 200);
    } catch (error) {
        next(error);
    }
});

/**
 * @swagger
 * /sicau/send_enrollments_sicau:
 *   post:
 *     summary: Guardar matrículas provenientes del sistema SICAU
 *     tags: [SICAU]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               enrollments:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     cedula:            { type: string, example: "1111111124" }
 *                     role:              { type: string, example: "ESTUDIANTE" }
 *                     codigo_asignatura: { type: string, example: "FB0010" }
 *                     nombre_asignatura: { type: string, example: "Álgebra Lineal" }
 *                     programa:          { type: string, example: "Fundamentación" }
 *                     periodo:           { type: string, example: "20261" }
 *                     grupo:             { type: string, example: "G101" }
 *                     estado:            { type: string, example: "Activa" }
 *     responses:
 *       200:
 *         description: Matrículas guardadas
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       500:
 *         description: Error interno
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/send_enrollments_sicau', async (req, res, next) => {
    try {
        const items = req.body.enrollments || req.body.items || req.body || [];
        const lista = Array.isArray(items) ? items : [items];
        const results = [];
        for (const enr of lista) {
            const result = await ctrl.saveSicauMatricula(enr);
            results.push(result);
        }
        response.success(req, res, { results }, 200);
    } catch (error) {
        next(error);
    }
});

/**
 * @swagger
 * /sicau/send_curso_matricula_sicau:
 *   post:
 *     summary: Guardar un curso junto con sus matrículas en una sola operación (SICAU)
 *     description: Endpoint unificado que combina la creación/actualización de un curso con la matrícula de los usuarios asociados a él, evitando tener que llamar por separado a los endpoints de cursos y matrículas.
 *     tags: [SICAU]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [course]
 *                   properties:
 *                     course:
 *                       type: object
 *                       properties:
 *                         codigo_asignatura: { type: string, example: "FB0010" }
 *                         nombre_asignatura: { type: string, example: "Álgebra Lineal" }
 *                         programa:          { type: string, example: "Fundamentación" }
 *                         periodo:           { type: string, example: "20261" }
 *                         grupo:             { type: string, example: "G101" }
 *                         docente:           { type: string, example: "Johana Ramirez" }
 *                         fecha_inicio:      { type: string, example: "2026-01-15" }
 *                         fecha_fin:         { type: string, example: "2026-06-15" }
 *                     enrollments:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           cedula: { type: string, example: "1111111124" }
 *                           role:   { type: string, example: "ESTUDIANTE" }
 *                           estado: { type: string, example: "Activa" }
 *     responses:
 *       200:
 *         description: Curso y matrículas guardados
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
 *                     results:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           course:
 *                             type: object
 *                             properties:
 *                               idnumber:  { type: string }
 *                               shortname: { type: string }
 *                               status:    { type: string, example: "saved" }
 *                           enrollments:
 *                             type: array
 *                             items:
 *                               type: object
 *                               properties:
 *                                 cedula:         { type: string }
 *                                 codigo_journey: { type: string }
 *                                 status:         { type: string, example: "saved" }
 *       500:
 *         description: Error interno
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/send_curso_matricula_sicau', async (req, res, next) => {
    try {
        const items = req.body.items || req.body || [];
        const lista = Array.isArray(items) ? items : [items];
        const results = [];
        for (const item of lista) {
            const result = await ctrl.saveSicauCursoYMatriculas(item);
            results.push(result);
        }
        response.success(req, res, { results }, 200);
    } catch (error) {
        next(error);
    }
});

module.exports = router;