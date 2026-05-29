const { Router } = require('express');
const router = Router();
const response = require('../../network/response');
const ctrl = require('./index');
const { moodleRequest } = require('../../services/moodleService');
const syncService = require('../../services/syncService');
const path = require('path');
const fs = require('fs');

// ─── RUTAS EXCEL ──────────────────────────────────────────────────────────────

/**
 * @swagger
 * /users/upload-excel:
 *   post:
 *     summary: Subir archivo Excel para carga masiva
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               excel:
 *                 type: string
 *                 format: binary
 *                 description: Archivo .xlsx con columnas name, last_name, document, email
 *     responses:
 *       200:
 *         description: Archivo subido correctamente
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
 *                     filePath: { type: string, example: "/uploads/excel_123.xlsx" }
 *       400:
 *         description: No se recibió archivo
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/upload-excel', (req, res) => {
    if (!req.files || !req.files.excel) {
        return response.error(req, res, 'No se recibió ningún archivo.', 400);
    }
    const file = req.files.excel;
    const uploadDir = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    const fileName = `excel_${Date.now()}_${file.name}`;
    const filePath = path.join(uploadDir, fileName);
    file.mv(filePath, (err) => {
        if (err) return response.error(req, res, err.message, 500);
        response.success(req, res, { filePath }, 200);
    });
});
/**
 * @swagger
 * /users/process-excel:
 *   post:
 *     summary: Procesar archivo Excel subido y crear usuarios en Moodle
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [filePath]
 *             properties:
 *               filePath:
 *                 type: string
 *                 example: "/uploads/excel_123.xlsx"
 *     responses:
 *       200:
 *         description: Resultado del procesamiento
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
 *                     message:      { type: string }
 *                     successCount: { type: integer, example: 10 }
 *                     errorCount:   { type: integer, example: 2 }
 *                     errorFileUrl: { type: string, example: "/uploads/errores_123.xlsx" }
 *       400:
 *         description: No se especificó filePath
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Error interno
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/process-excel', async (req, res) => {
    const { filePath } = req.body;
    if (!filePath) return response.error(req, res, 'No se ha especificado la ruta del archivo.', 400);
    try {
        const result = await processExcelAndCreateUsers(filePath);
        if (result.errors.length > 0) {
            const errorExcelPath = await generateErrorExcel(result.errors);
            response.success(req, res, {
                message:      'Proceso completado con errores.',
                successCount: result.successCount,
                errorCount:   result.errorCount,
                errorFileUrl: `/uploads/${path.basename(errorExcelPath)}`
            }, 200);
        } else {
            response.success(req, res, {
                message:      'Usuarios cargados con éxito.',
                successCount: result.successCount
            }, 200);
        }
    } catch (error) {
        response.error(req, res, `Error interno: ${error.message}`, 500);
    } finally {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
});

// ─── RUTAS MOODLE ─────────────────────────────────────────────────────────────
/**
 * @swagger
 * /users/add_user:
 *   post:
 *     summary: Crear usuario en Moodle
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, document, firstname, lastname]
 *             properties:
 *               email:     { type: string, example: "juan@correo.com" }
 *               document:  { type: string, example: "1234567890" }
 *               firstname: { type: string, example: "Juan" }
 *               lastname:  { type: string, example: "Pérez" }
 *               city:      { type: string, example: "Medellín" }
 *               country:   { type: string, example: "CO" }
 *     responses:
 *       200:
 *         description: Usuario creado en Moodle
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
router.post('/add_user', async (req, res) => {
    const { email, document: documento, firstname, lastname, city, country } = req.body;
    try {
        const result = await moodleRequest('core_user_create_users', {
            'users[0][username]':  email,
            'users[0][email]':     email,
            'users[0][password]':  documento,
            'users[0][idnumber]':  documento,
            'users[0][firstname]': firstname,
            'users[0][lastname]':  lastname,
            'users[0][city]':      city    || 'Medellin',
            'users[0][country]':   country || 'CO',
        });
        if (result && result.exception) throw new Error(result.message);
        response.success(req, res, result, 200);
    } catch (error) {
        response.error(req, res, error.message, 500);
    }
});
/**
 * @swagger
 * /users/update_user:
 *   post:
 *     summary: Actualizar usuario en Moodle
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [id]
 *             properties:
 *               id:        { type: integer, example: 42 }
 *               firstname: { type: string }
 *               lastname:  { type: string }
 *               email:     { type: string }
 *               password:  { type: string }
 *               city:      { type: string }
 *               suspended: { type: integer, enum: [0, 1] }
 *     responses:
 *       200:
 *         description: Usuario actualizado
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
router.post('/update_user', async (req, res) => {
    const params = { 'users[0][id]': req.body.id };
    if (req.body.firstname)               params['users[0][firstname]']  = req.body.firstname;
    if (req.body.lastname)                params['users[0][lastname]']   = req.body.lastname;
    if (req.body.email)                   params['users[0][email]']      = req.body.email;
    if (req.body.password)                params['users[0][password]']   = req.body.password;
    if (req.body.city)                    params['users[0][city]']       = req.body.city;
    if (req.body.suspended !== undefined) params['users[0][suspended]']  = req.body.suspended;
    try {
        const result = await moodleRequest('core_user_update_users', params);
        response.success(req, res, result || 'Usuario actualizado', 200);
    } catch (error) {
        response.error(req, res, error.message, 500);
    }
});
/**
 * @swagger
 * /users/delete_user:
 *   post:
 *     summary: Suspender usuario en Moodle
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [userids]
 *             properties:
 *               userids:
 *                 type: array
 *                 items: { type: integer }
 *                 example: [42]
 *     responses:
 *       200:
 *         description: Usuario suspendido correctamente
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
router.post('/delete_user', async (req, res) => {
    const userId = req.body.userids[0];
    try {
        const result = await moodleRequest('core_user_update_users', {
            'users[0][id]':        userId,
            'users[0][suspended]': 1,
        });
        if (result && result.exception) throw new Error(result.message);
        response.success(req, res, 'Usuario suspendido correctamente', 200);
    } catch (error) {
        response.error(req, res, error.message, 500);
    }
});
/**
 * @swagger
 * /users/search_user:
 *   post:
 *     summary: Buscar usuario en Moodle por criterio
 *     tags: [Users]
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
router.post('/search_user', async (req, res) => {
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
 * /users/get_users:
 *   get:
 *     summary: Listar usuarios de Moodle
 *     tags: [Users]
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
router.get('/get_users', async (req, res) => {
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

// ─── RUTAS DB ─────────────────────────────────────────────────────────────────
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
router.get('/test', async (req, res) => {
    try {
        const data = await ctrl.list('logs');
        response.success(req, res, { test_message: 'Api Users Working!', table: data }, 200);
    } catch (error) {
        response.error(req, res, error.message, 500);
    }
});
/**
 * @swagger
 * /users/sicau:
 *   post:
 *     summary: Guardar usuarios provenientes del sistema SICAU
 *     tags: [Users]
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
router.post('/sicau', async (req, res, next) => {
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

// ─── SYNC ─────────────────────────────────────────────────────────────────────
/**
 * @swagger
 * /users/sync/preview:
 *   post:
 *     summary: Vista previa de estudiantes a sincronizar
 *     tags: [Users]
 *     responses:
 *       200:
 *         description: Lista de estudiantes pendientes de sincronización
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
        const result = await syncService.previewStudents();
        response.success(req, res, result, 200);
    } catch (error) {
        next(error);
    }
});
/**
 * @swagger
 * /users/sync:
 *   post:
 *     summary: Sincronizar estudiantes seleccionados con Moodle
 *     tags: [Users]
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
 *                   $ref: '#/components/schemas/User'
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
        const result = await syncService.syncStudents(req.body.items || []);
        response.success(req, res, result || 'Datos cargados correctamente', 200);
    } catch (error) {
        next(error);
    }
});
// ─── MÓDULOS ──────────────────────────────────────────────────────────────────
/**
 * @swagger
 * /users/journey:
 *   post:
 *     summary: Crear usuario directamente en Journey
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/User'
 *     responses:
 *       201:
 *         description: Usuario creado en Journey
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
router.post('/journey', async (req, res, next) => {
    try {
        const result = await ctrl.saveJourneyUsuario(req.body);
        response.success(req, res, result, 201);
    } catch (error) {
        next(error);
    }
});
/**
 * @swagger
 * /users/reset-password/{id}:
 *   post:
 *     summary: Resetear contraseña de un usuario
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del usuario
 *     responses:
 *       200:
 *         description: Contraseña reseteada correctamente
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
router.post('/reset-password/:id', async (req, res, next) => {
    try {
        const result = await ctrl.resetUserPassword(req.params.id);
        response.success(req, res, result, 200);
    } catch (error) {
        next(error);
    }
});
/**
 * @swagger
 * /users/{id}/enrollments:
 *   get:
 *     summary: Obtener matrículas de un usuario
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del usuario
 *     responses:
 *       200:
 *         description: Lista de matrículas del usuario
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
 *                     $ref: '#/components/schemas/Enrollment'
 *       500:
 *         description: Error interno
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/:id/enrollments', async (req, res, next) => {
    try {
        const result = await ctrl.getUserEnrollments(req.params.id);
        response.success(req, res, result, 200);
    } catch (error) {
        next(error);
    }
});
/**
 * @swagger
 * /users/{id}:
 *   put:
 *     summary: Actualizar usuario en Journey
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del usuario
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/User'
 *     responses:
 *       200:
 *         description: Usuario actualizado
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
 *   delete:
 *     summary: Eliminar usuario de Journey
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del usuario
 *     responses:
 *       200:
 *         description: Usuario eliminado correctamente
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
router.put('/:id', async (req, res, next) => {
    try {
        const result = await ctrl.updateJourneyUser({ ...req.body, id: req.params.id })
        response.success(req, res, result, 200)
    } catch (error) {
        next(error)
    }
})

router.delete('/:id', async (req, res, next) => {
    try {
        await ctrl.deleteUser(req.params.id)
        response.success(req, res, 'Usuario eliminado', 200)
    } catch (error) {
        next(error)
    }
})

module.exports = router;