const { Router } = require('express');
const router = Router();
const response = require('../../network/response');
const ctrl = require('./index');
const { moodleRequest } = require('../../services/moodleService');
const postgresql = require('../../database/postgresql');

// Estos endpoints no pasan por checkAuth (los llama el sistema SICAU o se
// prueban a mano desde Postman, sin sesión de usuario), así que no hay
// req.user.email para el middleware saveLog. Se deja igual un registro de
// auditoría best-effort, con username fijo 'SICAU', para que en Ver Logs
// quede rastro de lo que llegó desde afuera y no solo de lo que se hace
// dentro del panel. La descripción imita el formato "MÉTODO /ruta" de
// saveLog para que AdminLogs.jsx la clasifique igual (por prefijo de ruta).
function logIngestaSicau(req, cantidad, etiqueta) {
    const descripcion = `${req.method} ${req.baseUrl}${req.path} — ${cantidad} ${etiqueta}`;
    postgresql
        .insertLog(req.method.toLowerCase(), descripcion, 'SICAU', 'sicau', null)
        .catch((err) => console.error('No se pudo registrar el log de auditoría (SICAU):', err.message));
}
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
        logIngestaSicau(req, lista.length, 'usuario(s)');
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
 *                     nombre_profesor:   { type: string, example: "Johana Ramirez" }
 *                     documento:         { type: string, example: "1035421789" }
 *                     celular:           { type: string, example: "3001234567" }
 *                     correo_institucional: { type: string, example: "johana.ramirez@pascualbravo.edu.co" }
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
        logIngestaSicau(req, lista.length, 'curso(s)');
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
        logIngestaSicau(req, lista.length, 'matrícula(s)');
        response.success(req, res, { results }, 200);
    } catch (error) {
        next(error);
    }
});

/**
 * @swagger
 * /sicau/send_courses_enrollments_sicau:
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
 *                         nombre_asignatura: { type: string, example: "Base de Datos II" }
 *                         programa:          { type: string, example: "Tecnologia en desarrollo de software" }
 *                         departamento:      { type: string, example: "Sistemas Digitales" }
 *                         periodo:           { type: string, example: "20261" }
 *                         grupo:             { type: string, example: "G101" }
 *                         nombre_profesor:   { type: string, example: "Johana Ramirez" }
 *                         documento:         { type: string, example: "1035421789" }
 *                         celular:           { type: string, example: "3001234567" }
 *                         correo_institucional: { type: string, example: "johana.ramirez@pascualbravo.edu.co" }
 *                         fecha_inicio:      { type: string, example: "2026-01-15" }
 *                         fecha_fin:         { type: string, example: "2026-06-15" }
 *                     enrollments:
 *                       type: array
 *                       items:
 *                         type: object
 *                         description: >
 *                           codigo_asignatura/nombre_asignatura/programa/periodo/grupo son opcionales aquí:
 *                           si SICAU los manda en la matrícula, tienen prioridad sobre los del curso padre
 *                           (necesario cuando una matrícula no corresponde exactamente al curso del bloque,
 *                           p.ej. mismo envío agrupando varias asignaturas). Si no vienen, se usan los del curso.
 *                         properties:
 *                           cedula:            { type: string, example: "1111111124" }
 *                           role:              { type: string, example: "ESTUDIANTE" }
 *                           codigo_asignatura: { type: string, example: "FB0010" }
 *                           nombre_asignatura: { type: string, example: "Base de Datos II" }
 *                           programa:          { type: string, example: "Tecnologia en desarrollo de software" }
 *                           periodo:           { type: string, example: "20261" }
 *                           grupo:             { type: string, example: "G101" }
 *                           estado:            { type: string, example: "Activa" }
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
 *                             description: >
 *                               Si el curso trae nombre_profesor/documento/correo_institucional, el profesor
 *                               se crea como usuario si no existía (localizado por documento) y queda
 *                               matriculado en el curso con rol editingteacher (ver course.profesor).
 *                             properties:
 *                               idnumber:  { type: string }
 *                               shortname: { type: string }
 *                               status:    { type: string, example: "saved" }
 *                               profesor:
 *                                 type: object
 *                                 description: Resultado de crear/matricular al profesor. status "omitido" si faltó nombre_profesor, documento o correo_institucional.
 *                                 properties:
 *                                   status: { type: string, example: "saved" }
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
router.post('/send_courses_enrollments_sicau', async (req, res, next) => {
    try {
        const items = req.body.items || req.body || [];
        const lista = Array.isArray(items) ? items : [items];
        const results = [];
        for (const item of lista) {
            const result = await ctrl.saveSicauCursoYMatriculas(item);
            results.push(result);
        }
        logIngestaSicau(req, lista.length, 'curso(s)+matrícula(s)');
        response.success(req, res, { results }, 200);
    } catch (error) {
        next(error);
    }
});

module.exports = router;