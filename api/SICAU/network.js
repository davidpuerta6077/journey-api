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
// SICAU manda el usuario que originó el envío como campo "usuario" en el
// body (a nivel de cada curso/usuario/matrícula). Antes se buscaba en un
// header propio (nunca se confirmó el nombre exacto), así que eso se deja
// como fallback por si algún envío viejo todavía lo manda así.
const SICAU_USER_HEADER_CANDIDATES = ['x-sicau-user', 'x-sicau-usuario', 'x-usuario', 'x-user', 'usuario'];

function getSicauUsername(req, bodyUsuario) {
    if (bodyUsuario) return String(bodyUsuario);
    // También puede venir al final del body, al mismo nivel que la lista
    // ({ users: [...], usuario: "..." }) en vez de dentro de cada ítem.
    if (req.body && !Array.isArray(req.body) && req.body.usuario) return String(req.body.usuario);
    for (const header of SICAU_USER_HEADER_CANDIDATES) {
        const value = req.headers[header];
        if (value) return String(value);
    }
    console.error('[SICAU] No se encontró el usuario (ni en el body ni en headers) en la petición, headers recibidos:', JSON.stringify(req.headers));
    return 'SICAU';
}

// La descripción imita el formato "MÉTODO /ruta" de saveLog para que
// AdminLogs.jsx la clasifique igual (por prefijo de ruta) y se queda en un
// resumen general (cuántos ítems de qué tipo); el detail completo (código/
// nombre/correo de cada uno) va aparte en la columna `detail`, para el
// desplegable "ver detalle" del front — así la tabla no queda ilegible con
// una lista larga pegada en la descripción.
function logIngestaSicau(req, resumen, detail, bodyUsuario) {
    const descripcion = `${req.method} ${req.baseUrl}${req.path} — ${resumen}`;
    const username = getSicauUsername(req, bodyUsuario);
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
 *                   type: object
 *                   description: Igual a User pero sin id ni moodle_id (los asigna journey, SICAU no los manda)
 *                   properties:
 *                         username:              { type: string }
 *                         firstname:             { type: string }
 *                         lastname:              { type: string }
 *                         email:                 { type: string }
 *                         documento:             { type: string }
 *                         correo_personal:       { type: string }
 *                         telefono:              { type: string }
 *                         celular:               { type: string }
 *                         fecha_nacimiento:      { type: string, format: date }
 *                         jornada:               { type: string }
 *                         departamento_academico: { type: string }
 *                         plan_estudios:         { type: string }
 *                         city:                  { type: string }
 *                         country:               { type: string }
 *                         usuario: { type: string, example: "jor.ramirez", description: "Usuario de SICAU que originó el envío, para el log de auditoría" }
 *                         estado:
 *                           type: string
 *                           example: "Matriculado"
 *                           description: >
 *                             Estado académico del estudiante que manda SICAU (mismo valor que el estado
 *                             de matrícula, ver Enrollment.estado). Al crear el usuario siempre llega
 *                             "Matriculado"; en envíos posteriores puede cambiar (retiro, cancelación...).
 *                         novedad:
 *                           type: object
 *                           description: >
 *                             Novedad ya calculada del lado de SICAU (p.ej. usuario nuevo o cambio de
 *                             datos). Se guarda en sicau_novedades (nivel "usuario") para verse en
 *                             Sync > Novedades; no altera la lógica de guardado del usuario.
 *                           properties:
 *                             tipo: { type: string, example: "NUEVO" }
 *                             cambios:
 *                               type: array
 *                               items:
 *                                 type: object
 *                                 properties:
 *                                   campo:    { type: string, example: "jornada" }
 *                                   anterior: { type: string, example: "PRESENCIAL" }
 *                                   actual:   { type: string, example: "VIRTUAL" }
 *     responses:
 *       200:
 *         description: >
 *           Usuarios guardados. `results` trae un item por cada usuario enviado, en el mismo orden,
 *           con `email` y `documento` como identificador (no depender de la posición en el array).
 *
 *           Valores posibles de `status` (siempre viene `ok` boolean, true salvo "error"):
 *
 *           | status  | ok    | Significado |
 *           |---------|-------|-------------|
 *           | created | true  | Usuario nuevo, se creó |
 *           | updated | true  | Usuario ya existía (localizado por documento), se actualizaron sus datos |
 *           | error   | false | No se pudo procesar; el motivo va en `error` (texto) |
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
 *                           email:     { type: string, example: "juan.perez@pascualbravo.edu.co" }
 *                           documento: { type: string, example: "1035421789" }
 *                           ok:        { type: boolean, example: true }
 *                           status:    { type: string, enum: [created, updated, error], example: "updated" }
 *                           error:     { type: string, example: "El correo ya está registrado para otro usuario", description: "Solo viene si ok es false" }
 *             examples:
 *               ejemplo:
 *                 value:
 *                   error: false
 *                   status: 200
 *                   body:
 *                     results:
 *                       - { email: "juan.perez@pascualbravo.edu.co", documento: "1035421789", ok: true, status: "updated" }
 *                       - { email: "ana.gomez@pascualbravo.edu.co", documento: "1001463268", ok: false, status: "error", error: "El correo ya está registrado para otro usuario" }
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
            username: u.username, email: u.email, nombre: `${u.firstname || ''} ${u.lastname || ''}`.trim(), status: results[i]?.status, error: results[i]?.error,
        })), lista[0]?.usuario);
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
 *                     usuario:           { type: string, example: "jor.ramirez", description: "Usuario de SICAU que originó el envío, para el log de auditoría" }
 *                     novedad:
 *                       type: object
 *                       description: >
 *                         Si SICAU marca que el curso ya no necesita grupo virtual (p.ej. desde
 *                         "Gestión de grupos virtuales"), manda tipo "RETIRO": se desmatriculan sus
 *                         estudiantes activos y no se crea/actualiza el curso. Un cambio de profesor
 *                         o de fechas de un curso existente NO se manda por aquí: journey lo detecta
 *                         solo comparando contra lo ya guardado y registra la novedad (CAMBIO_DE_PROFESOR
 *                         / CAMBIO_DE_FECHAS) automáticamente.
 *                       properties:
 *                         tipo:   { type: string, example: "RETIRO" }
 *                         motivo: { type: string, example: "NO_REQUIERE_CURSO_VIRTUAL" }
 *     responses:
 *       200:
 *         description: >
 *           Cursos guardados. `results` trae un item por curso enviado, en el mismo orden, con
 *           `codigo_asignatura`/`periodo`/`grupo` como identificador.
 *
 *           Valores posibles de `status` (siempre viene `ok` boolean, true salvo "error"):
 *
 *           | status            | ok    | Significado |
 *           |-------------------|-------|-------------|
 *           | created           | true  | Curso nuevo, se creó |
 *           | updated_profesor  | true  | Curso ya existía, cambió el profesor (gana sobre fechas/asignatura si varias cambiaron a la vez) |
 *           | updated_fechas    | true  | Curso ya existía, cambiaron fecha_inicio y/o fecha_fin (y no el profesor) |
 *           | updated_asignatura| true  | Curso ya existía, cambió el nombre de la asignatura (y no profesor ni fechas) |
 *           | exists            | true  | Curso ya existía, sin cambios |
 *           | unenrolled        | true  | `novedad.tipo: "RETIRO"`: se desmatricularon sus estudiantes activos, el curso no se toca |
 *           | error             | false | No se pudo procesar; el motivo va en `error` (texto) |
 *
 *           Cada resultado trae además `profesor` (si el curso mandó nombre_profesor/documento/
 *           correo_institucional): mismo patrón `{ok, status}`, con `status: "omitido"` (ok:false)
 *           si faltó alguno de esos tres datos, o `created`/`exists`/`updated_estado`/`error` si se
 *           intentó matricular al profesor (ver tabla de /send_enrollments_sicau).
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
 *                           codigo_asignatura: { type: string, example: "FB0010" }
 *                           periodo:           { type: string, example: "20261" }
 *                           grupo:             { type: string, example: "G101" }
 *                           idnumber:          { type: string, example: "FB0010020261G101" }
 *                           ok:                { type: boolean, example: true }
 *                           status:            { type: string, enum: [created, updated_profesor, updated_fechas, updated_asignatura, exists, unenrolled, error] }
 *                           error:             { type: string, description: "Solo viene si ok es false" }
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
        })), lista[0]?.usuario);
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
 *                     usuario:           { type: string, example: "jor.ramirez", description: "Usuario de SICAU que originó el envío, para el log de auditoría" }
 *     responses:
 *       200:
 *         description: >
 *           Matrículas guardadas. `results` trae un item por matrícula enviada, en el mismo orden,
 *           con `cedula` como identificador.
 *
 *           Valores posibles de `status` (siempre viene `ok` boolean, true salvo "error"):
 *
 *           | status         | ok    | Significado |
 *           |----------------|-------|-------------|
 *           | created        | true  | Matrícula nueva, se creó |
 *           | updated_estado | true  | Matrícula ya existía, cambió `estado` (incluye enviar `estado: "Cancelada"`: se guarda como "Cancelado" y queda con este status, no se desmatricula sola — eso solo lo hace un RETIRO de curso) |
 *           | exists         | true  | Matrícula ya existía, mismo estado, sin cambios |
 *           | error          | false | No se pudo procesar (p.ej. la cédula no corresponde a ningún usuario); el motivo va en `error` (texto) |
 *
 *           Un RETIRO de curso (ver /send_courses_sicau y /send_courses_enrollments_sicau) no pasa
 *           por este endpoint: lo dispara el curso, no una matrícula individual, y cada matrícula
 *           desmatriculada queda con `status: "unenrolled"` en la respuesta de ese curso.
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
 *                           cedula:         { type: string, example: "1038106398" }
 *                           codigo_journey: { type: string, example: "FB0010020261G101" }
 *                           ok:             { type: boolean, example: true }
 *                           status:         { type: string, enum: [created, updated_estado, exists, error] }
 *                           error:          { type: string, description: "Solo viene si ok es false" }
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
        const usuario = getSicauUsername(req, lista[0]?.usuario);
        const results = [];
        for (const enr of lista) {
            const result = await ctrl.saveSicauMatricula(enr, usuario);
            results.push(result);
        }
        logIngestaSicau(req, `${lista.length} matrícula(s)`, lista.map((e, i) => ({
            cedula: e.cedula, role: e.role, codigo_asignatura: e.codigo_asignatura, grupo: e.grupo, periodo: e.periodo, estado: e.estado, status: results[i]?.status,
            ...(e.novedad ? { novedad: e.novedad } : {}),
        })), usuario);
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
 *     description: >
 *       Endpoint unificado que combina la creación/actualización de un curso con la matrícula de los
 *       usuarios asociados a él, evitando tener que llamar por separado a los endpoints de cursos y
 *       matrículas. Acepta tanto un lote (`{ items: [{course, enrollments}, ...] }`) como un único
 *       curso enviado directo en el body (`{ course: {...}, enrollments: [...] }`).
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
 *                         usuario:           { type: string, example: "jor.ramirez", description: "Usuario de SICAU que originó el envío, para el log de auditoría" }
 *                         novedad:
 *                           type: object
 *                           description: >
 *                             tipo "RETIRO" si el curso ya no necesita grupo virtual: se desmatriculan
 *                             sus estudiantes activos y no se crea/actualiza el curso (enrollments se
 *                             ignora en ese caso). Un cambio de profesor o de fechas lo detecta journey
 *                             solo, comparando contra lo ya guardado; no se manda por aquí.
 *                           properties:
 *                             tipo:   { type: string, example: "RETIRO" }
 *                             motivo: { type: string, example: "NO_REQUIERE_CURSO_VIRTUAL" }
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
 *                           novedad:
 *                             type: object
 *                             description: >
 *                               Novedad ya calculada del lado de SICAU (p.ej. cambio de grupo). Se guarda
 *                               tal cual en el log de auditoría como referencia; journey sigue detectando
 *                               sus propias novedades (traslado/cambio de estado) comparando contra lo
 *                               que ya tiene guardado, este campo no altera esa lógica.
 *                             properties:
 *                               tipo: { type: string, example: "CAMBIO_DE_GRUPO" }
 *                               cambios:
 *                                 type: array
 *                                 items:
 *                                   type: object
 *                                   properties:
 *                                     campo:    { type: string, example: "grupo" }
 *                                     anterior: { type: string, example: "G101" }
 *                                     actual:   { type: string, example: "G102" }
 *     responses:
 *       200:
 *         description: >
 *           Curso y matrículas guardados. `results` trae un item por cada `{course, enrollments}` del
 *           envío, en el mismo orden. `course` identifica con `codigo_asignatura`/`periodo`/`grupo` y
 *           cada matrícula de `enrollments` con `cedula` — no depender de la posición en el array.
 *           Todo resultado (curso, matrícula o el sub-objeto `course.profesor`) trae siempre `ok`
 *           (boolean) además de `status`: así no hace falta interpretar el string para saber si quedó
 *           aplicado, y un `status` nuevo que se agregue a futuro no rompe nada que solo mire `ok`.
 *           Si `ok` es `false`, el motivo va como texto en `error`.
 *
 *           Valores posibles de `course.status`:
 *
 *           | status             | ok    | Significado |
 *           |--------------------|-------|-------------|
 *           | created            | true  | Curso nuevo, se creó |
 *           | updated_profesor   | true  | Curso ya existía, cambió el profesor (gana sobre fechas/asignatura si varias cambiaron a la vez) |
 *           | updated_fechas     | true  | Curso ya existía, cambiaron fecha_inicio y/o fecha_fin (y no el profesor) |
 *           | updated_asignatura | true  | Curso ya existía, cambió el nombre de la asignatura (y no profesor ni fechas) |
 *           | exists             | true  | Curso ya existía, sin cambios |
 *           | unenrolled         | true  | `course.novedad.tipo: "RETIRO"`: se desmatricularon sus estudiantes activos, el curso no se crea/actualiza. `enrollments` trae un item por cada matrícula desmatriculada (ver abajo), no se procesa el `enrollments` enviado en el request |
 *           | error              | false | No se pudo procesar el curso; el motivo va en `error` |
 *
 *           Valores posibles de `course.profesor.status` (solo si el curso trajo nombre_profesor/
 *           documento/correo_institucional — si falta alguno, no se intenta y queda "omitido"):
 *
 *           | status         | ok    | Significado |
 *           |----------------|-------|-------------|
 *           | created        | true  | El profesor no existía como usuario, se creó y matriculó |
 *           | exists         | true  | El profesor ya estaba matriculado en el curso, sin cambios |
 *           | updated_estado | true  | El profesor ya tenía una matrícula en el curso con otro estado, se actualizó |
 *           | omitido        | false | Faltó nombre_profesor, documento o correo_institucional: no se creó ni matriculó |
 *           | error          | false | No se pudo crear/matricular; el motivo va en `error` |
 *
 *           Valores posibles de cada item de `enrollments[].status`:
 *
 *           | status         | ok    | Significado |
 *           |----------------|-------|-------------|
 *           | created        | true  | Matrícula nueva, se creó |
 *           | updated_estado | true  | Matrícula ya existía, cambió `estado` (incluye `estado: "Cancelada"`: se guarda como "Cancelado" y queda con este status — una matrícula Cancelada NO se desmatricula sola, eso solo lo hace un RETIRO de curso) |
 *           | exists         | true  | Matrícula ya existía, mismo estado, sin cambios |
 *           | unenrolled     | true  | Viene de un `course.novedad.tipo: "RETIRO"`: esta matrícula estaba activa y se desmatriculó junto con el curso |
 *           | error          | false | No se pudo procesar (p.ej. la cédula no corresponde a ningún usuario); el motivo va en `error` |
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
 *                               codigo_asignatura: { type: string, example: "FB0010" }
 *                               periodo:           { type: string, example: "20261" }
 *                               grupo:             { type: string, example: "G101" }
 *                               idnumber:          { type: string, example: "FB0010020261G101" }
 *                               ok:                { type: boolean, example: true }
 *                               status:            { type: string, enum: [created, updated_profesor, updated_fechas, updated_asignatura, exists, unenrolled, error] }
 *                               error:             { type: string, description: "Solo viene si ok es false" }
 *                               profesor:
 *                                 type: object
 *                                 properties:
 *                                   ok:     { type: boolean }
 *                                   status: { type: string, enum: [created, exists, updated_estado, omitido, error] }
 *                                   error:  { type: string, description: "Solo viene si ok es false" }
 *                           enrollments:
 *                             type: array
 *                             items:
 *                               type: object
 *                               properties:
 *                                 cedula:         { type: string, example: "1038106398" }
 *                                 codigo_journey: { type: string, example: "FB0010020261G101" }
 *                                 ok:             { type: boolean }
 *                                 status:         { type: string, enum: [created, updated_estado, exists, unenrolled, error] }
 *                                 error:          { type: string, description: "Solo viene si ok es false" }
 *             examples:
 *               curso_actualizado_con_error_de_matricula:
 *                 summary: Curso con cambio de profesor + una matrícula creada y otra con error
 *                 value:
 *                   error: false
 *                   status: 200
 *                   body:
 *                     results:
 *                       - course: { codigo_asignatura: "PR0635", periodo: "20262", grupo: "100", idnumber: "PR0635020262G100", ok: true, status: "updated_profesor" }
 *                         enrollments:
 *                           - { cedula: "1038106398", codigo_journey: "PR0635020262G100", ok: true, status: "created" }
 *                           - { cedula: "1017178084", codigo_journey: "PR0635020262G100", ok: false, status: "error", error: "duplicate key value violates unique constraint users_email_uniq" }
 *               retiro_de_curso:
 *                 summary: "course.novedad.tipo: RETIRO — se desmatriculan las activas, no se envían enrollments"
 *                 value:
 *                   error: false
 *                   status: 200
 *                   body:
 *                     results:
 *                       - course: { codigo_asignatura: "FB0010", periodo: "20261", grupo: "G101", codigo_journey: "FB0010020261G101", ok: true, status: "unenrolled", desmatriculadas: 2 }
 *                         enrollments:
 *                           - { cedula: "1038106398", codigo_journey: "FB0010020261G101", ok: true, status: "unenrolled" }
 *                           - { cedula: "1017178084", codigo_journey: "FB0010020261G101", ok: true, status: "unenrolled" }
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
        const usuario = getSicauUsername(req, lista[0]?.course?.usuario || lista[0]?.usuario);
        const results = [];
        for (const item of lista) {
            const result = await ctrl.saveSicauCursoYMatriculas(item, usuario);
            results.push(result);
        }
        logIngestaSicau(req, `${lista.length} curso(s)+matrícula(s)`, lista.map((it, i) => ({
            codigo_asignatura: it.course?.codigo_asignatura, grupo: it.course?.grupo, nombre_asignatura: it.course?.nombre_asignatura,
            estado_curso: results[i]?.course?.status, cedulas_matriculadas: (it.enrollments || []).map(e => e.cedula).join(', '),
            ...(it.course?.novedad ? { novedad_curso: it.course.novedad, desmatriculadas: results[i]?.course?.desmatriculadas } : {}),
            novedades: (it.enrollments || []).filter(e => e.novedad).map(e => ({ cedula: e.cedula, novedad: e.novedad })),
        })), usuario);
        response.success(req, res, { results }, 200);
    } catch (error) {
        next(error);
    }
});

module.exports = router;