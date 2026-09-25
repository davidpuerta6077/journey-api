const { Router } = require('express');
const router = Router();
const response = require('../../network/response');
const ctrl = require('./index');
const { moodleRequest } = require('../../services/moodleService');
const postgresql = require('../../database/postgresql');

// Estos endpoints no pasan por checkAuth (los llama el sistema SICAU o se
// prueban a mano desde Postman, sin sesión de usuario), así que no hay
// req.user.email para el middleware saveLog. Se deja igual un registro de
// auditoría best-effort, para que en Ver Logs quede rastro de lo que llegó
// desde afuera y no solo de lo que se hace dentro del panel.
//
// SICAU ahora manda el usuario que originó el envío en un header propio
// (en vez de quemarlo como 'SICAU' fijo). Todavía no se confirmó el nombre
// exacto del header con el equipo de SICAU, así que se prueban los nombres
// más probables y, si ninguno trae valor, se cae a 'SICAU' y se deja un
// console.error con los headers completos de esa petición para poder
// identificar el correcto revisando los logs del servidor.
const SICAU_USER_HEADER_CANDIDATES = ['x-sicau-user', 'x-sicau-usuario', 'x-usuario', 'x-user', 'usuario'];

function getSicauUsername(req) {
    for (const header of SICAU_USER_HEADER_CANDIDATES) {
        const value = req.headers[header];
        if (value) return String(value);
    }
    console.error('[SICAU] No se encontró el header de usuario en la petición, headers recibidos:', JSON.stringify(req.headers));
    return 'SICAU';
}

// La descripción imita el formato "MÉTODO /ruta" de saveLog para que
// AdminLogs.jsx la clasifique igual (por prefijo de ruta) y se queda en un
// resumen general (cuántos ítems de qué tipo); el detail completo (código/
// nombre/correo de cada uno) va aparte en la columna `detail`, para el
// desplegable "ver detalle" del front — así la tabla no queda ilegible con
// una lista larga pegada en la descripción.
function logIngestaSicau(req, resumen, detail) {
    const descripcion = `${req.method} ${req.baseUrl}${req.path} — ${resumen}`;
    const username = getSicauUsername(req);
    postgresql
        .insertLog(req.method.toLowerCase(), descripcion, username, 'sicau', null, detail)
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
        logIngestaSicau(req, `${lista.length} usuario(s)`, lista.map((u, i) => ({
            username: u.username, email: u.email, nombre: `${u.firstname || ''} ${u.lastname || ''}`.trim(), status: results[i]?.status,
        })));
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
        logIngestaSicau(req, `${lista.length} curso(s)`, lista.map((c, i) => ({
            codigo_asignatura: c.codigo_asignatura, nombre_asignatura: c.nombre_asignatura, grupo: c.grupo, periodo: c.periodo, docente: c.docente, status: results[i]?.status,
        })));
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
        logIngestaSicau(req, `${lista.length} matrícula(s)`, lista.map((e, i) => ({
            cedula: e.cedula, role: e.role, codigo_asignatura: e.codigo_asignatura, grupo: e.grupo, periodo: e.periodo, estado: e.estado, status: results[i]?.status,
        })));
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
        logIngestaSicau(req, `${lista.length} curso(s)+matrícula(s)`, lista.map((it, i) => ({
            codigo_asignatura: it.course?.codigo_asignatura, grupo: it.course?.grupo, nombre_asignatura: it.course?.nombre_asignatura,
            estado_curso: results[i]?.course?.status, cedulas_matriculadas: (it.enrollments || []).map(e => e.cedula).join(', '),
        })));
        response.success(req, res, { results }, 200);
    } catch (error) {
        next(error);
    }
});

module.exports = router;