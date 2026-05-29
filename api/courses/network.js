const { Router } = require('express');
const router = Router();
const response = require('../../network/response');
const ctrl = require('./index');
const { moodleRequest } = require('../../services/moodleService');
const syncService = require('../../services/syncService');

// ─── RUTAS MOODLE ─────────────────────────────────────────────────────────────

/**
 * @swagger
 * /courses/add_course:
 *   post:
 *     summary: Crear curso en Moodle
 *     tags: [Courses]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [fullname, shortname, categoryid]
 *             properties:
 *               fullname:    { type: string, example: "Álgebra Lineal 2026-1" }
 *               shortname:   { type: string, example: "ALG2026-1" }
 *               categoryid:  { type: integer, example: 1 }
 *               idnumber:    { type: string, example: "FB001020261G101" }
 *               summary:     { type: string }
 *               visible:     { type: integer, enum: [0, 1], example: 1 }
 *               format:      { type: string, example: "topics" }
 *               numsections: { type: integer, example: 10 }
 *     responses:
 *       200:
 *         description: Curso creado en Moodle
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
router.post('/add_course', async (req, res) => {
    try {
        const result = await moodleRequest('core_course_create_courses', {
            'courses[0][fullname]':    req.body.fullname,
            'courses[0][shortname]':   req.body.shortname,
            'courses[0][categoryid]':  req.body.categoryid,
            'courses[0][idnumber]':    req.body.idnumber,
            'courses[0][summary]':     req.body.summary,
            'courses[0][visible]':     req.body.visible,
            'courses[0][format]':      req.body.format,
            'courses[0][numsections]': req.body.numsections,
        });
        response.success(req, res, result, 200);
    } catch (error) {
        response.error(req, res, error.message, 500);
    }
});

/**
 * @swagger
 * /courses/duplicate_course:
 *   post:
 *     summary: Duplicar curso semilla en Moodle
 *     tags: [Courses]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [courseid, fullname, shortname]
 *             properties:
 *               courseid:   { type: integer, example: 5 }
 *               fullname:   { type: string, example: "Álgebra Lineal 2026-1" }
 *               shortname:  { type: string, example: "ALG2026-1" }
 *               categoryid: { type: integer, example: 1 }
 *     responses:
 *       200:
 *         description: Curso duplicado
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
router.post('/duplicate_course', async (req, res) => {
    try {
        const result = await moodleRequest('core_course_duplicate_course', {
            'courseid':   req.body.courseid,
            'fullname':   req.body.fullname,
            'shortname':  req.body.shortname,
            'categoryid': req.body.categoryid
        });
        response.success(req, res, result, 200);
    } catch (error) {
        response.error(req, res, error.message, 500);
    }
});

/**
 * @swagger
 * /courses/update_course:
 *   post:
 *     summary: Actualizar curso en Moodle
 *     tags: [Courses]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [id]
 *             properties:
 *               id:         { type: integer, example: 10 }
 *               fullname:   { type: string }
 *               shortname:  { type: string }
 *               categoryid: { type: integer }
 *               idnumber:   { type: string }
 *               summary:    { type: string }
 *               visible:    { type: integer, enum: [0, 1] }
 *               format:     { type: string }
 *     responses:
 *       200:
 *         description: Curso actualizado
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
router.post('/update_course', async (req, res) => {
    try {
        const result = await moodleRequest('core_course_update_courses', {
            'courses[0][id]':         req.body.id,
            'courses[0][fullname]':   req.body.fullname,
            'courses[0][shortname]':  req.body.shortname,
            'courses[0][categoryid]': req.body.categoryid,
            'courses[0][idnumber]':   req.body.idnumber,
            'courses[0][summary]':    req.body.summary,
            'courses[0][visible]':    req.body.visible,
            'courses[0][format]':     req.body.format
        });
        response.success(req, res, result, 200);
    } catch (error) {
        response.error(req, res, error.message, 500);
    }
});

/**
 * @swagger
 * /courses/delete_course:
 *   post:
 *     summary: Eliminar curso de Moodle
 *     tags: [Courses]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [courseids]
 *             properties:
 *               courseids: { type: integer, example: 10 }
 *     responses:
 *       200:
 *         description: Curso eliminado
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
router.post('/delete_course', async (req, res) => {
    try {
        const result = await moodleRequest('core_course_delete_courses', {
            'courseids[0]': req.body.courseids
        });
        response.success(req, res, result, 200);
    } catch (error) {
        response.error(req, res, error.message, 500);
    }
});

/**
 * @swagger
 * /courses/search_course:
 *   post:
 *     summary: Buscar curso en Moodle por campo y valor
 *     tags: [Courses]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [field, value]
 *             properties:
 *               field: { type: string, example: "idnumber" }
 *               value: { type: string, example: "FB001020261G101" }
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
router.post('/search_course', async (req, res) => {
    try {
        const result = await moodleRequest('core_course_get_courses_by_field', {
            'field': req.body.field,
            'value': req.body.value
        });
        response.success(req, res, result, 200);
    } catch (error) {
        response.error(req, res, error.message, 500);
    }
});

/**
 * @swagger
 * /courses/list_course:
 *   post:
 *     summary: Listar todos los cursos de Moodle
 *     tags: [Courses]
 *     responses:
 *       200:
 *         description: Lista de cursos de Moodle
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
router.post('/list_course', async (req, res) => {
    try {
        const result = await moodleRequest('core_course_get_courses', {});
        response.success(req, res, result, 200);
    } catch (error) {
        response.error(req, res, error.message, 500);
    }
});

/**
 * @swagger
 * /courses/list_course_content:
 *   post:
 *     summary: Listar contenido de un curso de Moodle
 *     tags: [Courses]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [courseid]
 *             properties:
 *               courseid: { type: integer, example: 10 }
 *     responses:
 *       200:
 *         description: Contenido del curso
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
router.post('/list_course_content', async (req, res) => {
    try {
        const result = await moodleRequest('core_course_get_contents', {
            'courseid': req.body.courseid
        });
        response.success(req, res, result, 200);
    } catch (error) {
        response.error(req, res, error.message, 500);
    }
});

/**
 * @swagger
 * /courses/add_category:
 *   post:
 *     summary: Crear categoría en Moodle
 *     tags: [Courses]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name:              { type: string, example: "Ingeniería" }
 *               parent:            { type: integer, example: 0 }
 *               idnumber:          { type: string }
 *               description:       { type: string }
 *               descriptionformat: { type: integer, example: 1 }
 *     responses:
 *       200:
 *         description: Categoría creada
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
router.post('/add_category', async (req, res) => {
    try {
        const result = await moodleRequest('core_course_create_categories', {
            'categories[0][name]':              req.body.name,
            'categories[0][parent]':            req.body.parent,
            'categories[0][idnumber]':          req.body.idnumber,
            'categories[0][description]':       req.body.description,
            'categories[0][descriptionformat]': req.body.descriptionformat
        });
        response.success(req, res, result, 200);
    } catch (error) {
        response.error(req, res, error.message, 500);
    }
});

/**
 * @swagger
 * /courses/list_category:
 *   post:
 *     summary: Listar categorías de Moodle
 *     tags: [Courses]
 *     responses:
 *       200:
 *         description: Lista de categorías
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
router.post('/list_category', async (req, res) => {
    try {
        const result = await moodleRequest('core_course_get_categories', {});
        response.success(req, res, result, 200);
    } catch (error) {
        response.error(req, res, error.message, 500);
    }
});

/**
 * @swagger
 * /courses/list:
 *   get:
 *     summary: Listar cursos de Journey
 *     tags: [Courses]
 *     responses:
 *       200:
 *         description: Lista de cursos en Journey
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
router.get('/list', async (req, res) => {
    try {
        const list = await ctrl.listCoursesForSync();
        response.success(req, res, list, 200);
    } catch (error) {
        response.error(req, res, error.message, 500);
    }
});

// ─── RUTA SICAU ───────────────────────────────────────────────────────────────

/**
 * @swagger
 * /courses/sicau:
 *   post:
 *     summary: Guardar cursos provenientes del sistema SICAU
 *     tags: [Courses]
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
router.post('/sicau', async (req, res, next) => {
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

// ─── SYNC ─────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /courses/sync/preview:
 *   post:
 *     summary: Vista previa de cursos a sincronizar
 *     tags: [Courses]
 *     responses:
 *       200:
 *         description: Lista de cursos con estado de sincronización
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
router.post('/sync/preview', async (req, res, next) => {
    try {
        const result = await syncService.previewCourses();
        response.success(req, res, result, 200);
    } catch (error) {
        next(error);
    }
});

/**
 * @swagger
 * /courses/sync:
 *   post:
 *     summary: Sincronizar cursos seleccionados con Moodle
 *     tags: [Courses]
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
 *     responses:
 *       200:
 *         description: Sincronización completada
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
router.post('/sync', async (req, res, next) => {
    try {
        const result = await syncService.syncCourses(req.body.items || []);
        response.success(req, res, result || 'Datos cargados correctamente', 200);
    } catch (error) {
        next(error);
    }
});

module.exports = router;