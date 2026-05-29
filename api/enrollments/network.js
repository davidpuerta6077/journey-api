const { Router } = require('express');
const router = Router();
const response = require('../../network/response');
const ctrl = require('./index');
const { moodleRequest } = require('../../services/moodleService');
const syncService = require('../../services/syncService');
const path = require('path');
const fs = require('fs');
const xlsx = require('xlsx');

// ─── HELPERS EXCEL ────────────────────────────────────────────────────────────

function readExcel(filePath) {
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    return xlsx.utils.sheet_to_json(worksheet, { defval: '' });
}

async function generateErrorExcel(errors) {
    if (errors.length === 0) return null;
    const ws = xlsx.utils.json_to_sheet(errors);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, 'Errores');
    const fileName = `errores_procesamiento_${Date.now()}.xlsx`;
    const outputPath = path.join(__dirname, '../../uploads', fileName);
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    xlsx.writeFile(wb, outputPath);
    return outputPath;
}

// ─── RUTAS MOODLE ─────────────────────────────────────────────────────────────

/**
 * @swagger
 * /enrollments/enroll_users:
 *   post:
 *     summary: Matricular usuario en un curso de Moodle
 *     tags: [Enrollments]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [userid, courseid, roleid]
 *             properties:
 *               userid:   { type: integer, example: 42 }
 *               courseid: { type: integer, example: 10 }
 *               roleid:   { type: integer, example: 5 }
 *     responses:
 *       200:
 *         description: Usuario matriculado correctamente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         description: Error al matricular
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/enroll_users', async (req, res) => {
    try {
        const { userid, courseid, roleid } = req.body;
        const result = await enrolUserInMoodle(userid, courseid, roleid);
        if (result.success) response.success(req, res, 'Usuario matriculado correctamente', 200);
        else response.error(req, res, result.error, 400);
    } catch (error) {
        response.error(req, res, error.message, 500);
    }
});

/**
 * @swagger
 * /enrollments/unenroll_users:
 *   post:
 *     summary: Desmatricular usuario de un curso de Moodle
 *     tags: [Enrollments]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [userid, courseid, roleid]
 *             properties:
 *               userid:   { type: integer, example: 42 }
 *               courseid: { type: integer, example: 10 }
 *               roleid:   { type: integer, example: 5 }
 *     responses:
 *       200:
 *         description: Usuario desmatriculado
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
router.post('/unenroll_users', async (req, res) => {
    try {
        const result = await moodleRequest('enrol_manual_unenrol_users', {
            'enrolments[0][roleid]':   req.body.roleid,
            'enrolments[0][userid]':   req.body.userid,
            'enrolments[0][courseid]': req.body.courseid
        });
        response.success(req, res, result || 'Usuario desmatriculado', 200);
    } catch (error) {
        response.error(req, res, error.message, 500);
    }
});

/**
 * @swagger
 * /enrollments/add_user_and_enroll:
 *   post:
 *     summary: Crear usuario y matricularlo en un curso de Moodle
 *     tags: [Enrollments]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, firstname, lastname, courseid]
 *             properties:
 *               username:  { type: string }
 *               firstname: { type: string, example: "Juan" }
 *               lastname:  { type: string, example: "Pérez" }
 *               email:     { type: string, example: "juan@correo.com" }
 *               password:  { type: string }
 *               roleid:    { type: integer, example: 5 }
 *               courseid:  { type: integer, example: 10 }
 *     responses:
 *       200:
 *         description: Usuario creado y matriculado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         description: Faltan campos requeridos o error al matricular
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/add_user_and_enroll', async (req, res) => {
    try {
        const { username, firstname, lastname, email, password, roleid, courseid } = req.body;
        if (!email || !firstname || !lastname || !courseid) {
            return response.error(req, res, 'Faltan campos requeridos', 400);
        }
        let userId = await getUserIdByEmail(email);
        if (!userId) {
            const createResult = await moodleRequest('core_user_create_users', {
                'users[0][username]':  username || email.toLowerCase(),
                'users[0][password]':  password,
                'users[0][firstname]': firstname,
                'users[0][lastname]':  lastname,
                'users[0][email]':     email,
                'users[0][auth]':      'manual',
                'users[0][country]':   'CO'
            });
            if (!Array.isArray(createResult) || createResult.length === 0) {
                return response.error(req, res, 'Error al crear el usuario en Moodle', 500);
            }
            userId = createResult[0].id;
        }
        const enrolResult = await enrolUserInMoodle(userId, courseid, roleid || 5);
        if (!enrolResult.success) return response.error(req, res, `Usuario creado pero falló la matrícula: ${enrolResult.error}`, 400);
        response.success(req, res, { message: 'Usuario creado y matriculado', userId }, 200);
    } catch (error) {
        response.error(req, res, error.message, 500);
    }
});

/**
 * @swagger
 * /enrollments/suspend_enrollment:
 *   post:
 *     summary: Suspender o reactivar matrícula de un usuario en un curso
 *     tags: [Enrollments]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [userid, courseid]
 *             properties:
 *               userid:   { type: integer, example: 42 }
 *               courseid: { type: integer, example: 10 }
 *               roleid:   { type: integer, example: 5 }
 *               suspend:  { type: integer, enum: [0, 1], example: 1 }
 *     responses:
 *       200:
 *         description: Matrícula suspendida o reactivada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         description: Faltan campos o error de Moodle
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/suspend_enrollment', async (req, res) => {
    try {
        const { userid, courseid, roleid, suspend } = req.body;
        if (!userid || !courseid) return response.error(req, res, 'Faltan campos requeridos', 400);
        const result = await moodleRequest('enrol_manual_enrol_users', {
            'enrolments[0][userid]':   userid,
            'enrolments[0][courseid]': courseid,
            'enrolments[0][roleid]':   roleid,
            'enrolments[0][suspend]':  suspend ?? 1
        });
        if (result && result.exception) return response.error(req, res, result.message, 400);
        const action = suspend === 0 ? 'reactivada' : 'suspendida';
        response.success(req, res, { message: `Matrícula ${action}`, userid, courseid }, 200);
    } catch (error) {
        response.error(req, res, error.message, 500);
    }
});

/**
 * @swagger
 * /enrollments/suspend_multiple_enrollments:
 *   post:
 *     summary: Suspender o reactivar múltiples matrículas de un usuario
 *     tags: [Enrollments]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [userid, courseids]
 *             properties:
 *               userid:    { type: integer, example: 42 }
 *               roleid:    { type: integer, example: 5 }
 *               courseids: { type: array, items: { type: integer }, example: [10, 11, 12] }
 *               suspend:   { type: integer, enum: [0, 1], example: 1 }
 *     responses:
 *       200:
 *         description: Resultado del proceso masivo
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         description: Faltan campos requeridos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/suspend_multiple_enrollments', async (req, res) => {
    try {
        const { userid, roleid, courseids, suspend } = req.body;
        if (!userid || !courseids || !Array.isArray(courseids) || courseids.length === 0) {
            return response.error(req, res, 'Faltan campos requeridos', 400);
        }
        const results = { success: [], errors: [] };
        for (const [index, courseid] of courseids.entries()) {
            const params = {
                [`enrolments[${index}][userid]`]:   userid,
                [`enrolments[${index}][courseid]`]: courseid,
                [`enrolments[${index}][roleid]`]:   roleid,
                [`enrolments[${index}][suspend]`]:  suspend ?? 1
            };
            try {
                const result = await moodleRequest('enrol_manual_enrol_users', params);
                if (result && result.exception) results.errors.push({ courseid, error: result.message });
                else results.success.push({ courseid });
            } catch (err) {
                results.errors.push({ courseid, error: err.message });
            }
        }
        const action = suspend === 0 ? 'reactivadas' : 'suspendidas';
        response.success(req, res, {
            message:      `Matrículas ${action}. Exitosas: ${results.success.length}, Fallidas: ${results.errors.length}`,
            successCount: results.success.length,
            errorCount:   results.errors.length,
            success:      results.success,
            errors:       results.errors
        }, 200);
    } catch (error) {
        response.error(req, res, error.message, 500);
    }
});

/**
 * @swagger
 * /enrollments/reactivate_enrollment:
 *   post:
 *     summary: Reactivar matrícula suspendida
 *     tags: [Enrollments]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [userid, courseid]
 *             properties:
 *               userid:   { type: integer, example: 42 }
 *               courseid: { type: integer, example: 10 }
 *               roleid:   { type: integer, example: 5 }
 *     responses:
 *       200:
 *         description: Matrícula reactivada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         description: Faltan campos o error de Moodle
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/reactivate_enrollment', async (req, res) => {
    try {
        const { userid, courseid, roleid } = req.body;
        if (!userid || !courseid) return response.error(req, res, 'Faltan campos requeridos', 400);
        const result = await moodleRequest('enrol_manual_enrol_users', {
            'enrolments[0][userid]':   userid,
            'enrolments[0][courseid]': courseid,
            'enrolments[0][roleid]':   roleid,
            'enrolments[0][suspend]':  0
        });
        if (result && result.exception) return response.error(req, res, result.message, 400);
        response.success(req, res, { message: 'Matrícula reactivada', userid, courseid }, 200);
    } catch (error) {
        response.error(req, res, error.message, 500);
    }
});

/**
 * @swagger
 * /enrollments/upload-excel:
 *   post:
 *     summary: Subir archivo Excel para carga masiva de matrículas
 *     tags: [Enrollments]
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
 *     responses:
 *       200:
 *         description: Archivo subido correctamente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         description: No se recibió archivo
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/upload-excel', async (req, res) => {
    if (!req.files || Object.keys(req.files).length === 0) {
        return response.error(req, res, 'No se ha subido ningún archivo.', 400);
    }
    const excelFile = req.files.excel;
    const uploadPath = path.join(__dirname, '../../uploads', `upload_${Date.now()}_${excelFile.name}`);
    try {
        const dir = path.dirname(uploadPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        await excelFile.mv(uploadPath);
        response.success(req, res, { message: 'Archivo subido con éxito', filePath: uploadPath }, 200);
    } catch (err) {
        response.error(req, res, 'Error al subir el archivo.', 500);
    }
});

/**
 * @swagger
 * /enrollments/process-excel:
 *   post:
 *     summary: Procesar Excel y matricular usuarios en Moodle
 *     tags: [Enrollments]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [filePath]
 *             properties:
 *               filePath: { type: string, example: "/uploads/upload_123.xlsx" }
 *     responses:
 *       200:
 *         description: Resultado del procesamiento
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         description: No se especificó filePath
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/process-excel', async (req, res) => {
    const { filePath } = req.body;
    if (!filePath) return response.error(req, res, 'No se ha especificado la ruta.', 400);
    try {
        const result = await processExcelAndEnrolUsers(filePath);
        if (result.errors.length > 0) {
            const errorExcelPath = await generateErrorExcel(result.errors);
            response.success(req, res, {
                message:      'Proceso de matrículas con errores.',
                successCount: result.successCount,
                errorCount:   result.errorCount,
                errorFileUrl: `/uploads/${path.basename(errorExcelPath)}`
            }, 200);
        } else {
            response.success(req, res, { message: 'Matrículas exitosas.', successCount: result.successCount }, 200);
        }
    } catch (error) {
        response.error(req, res, `Error procesando matrículas: ${error.message}`, 500);
    } finally {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
});

/**
 * @swagger
 * /enrollments/process-novedades:
 *   post:
 *     summary: Procesar Excel y suspender usuarios en Moodle
 *     tags: [Enrollments]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [filePath]
 *             properties:
 *               filePath: { type: string, example: "/uploads/upload_123.xlsx" }
 *     responses:
 *       200:
 *         description: Resultado del procesamiento
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         description: No se especificó filePath
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/process-novedades', async (req, res) => {
    const { filePath } = req.body;
    if (!filePath) return response.error(req, res, 'No se ha especificado la ruta.', 400);
    try {
        const result = await processExcelAndSuspendUsers(filePath);
        if (result.errors.length > 0) {
            const errorExcelPath = await generateErrorExcel(result.errors);
            response.success(req, res, {
                message:      'Proceso de novedades con errores.',
                successCount: result.successCount,
                errorCount:   result.errorCount,
                errorFileUrl: `/uploads/${path.basename(errorExcelPath)}`
            }, 200);
        } else {
            response.success(req, res, { message: 'Usuarios suspendidos con éxito.', successCount: result.successCount }, 200);
        }
    } catch (error) {
        response.error(req, res, `Error procesando novedades: ${error.message}`, 500);
    } finally {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
});

/**
 * @swagger
 * /enrollments/list:
 *   get:
 *     summary: Listar matrículas con datos de usuario
 *     tags: [Enrollments]
 *     responses:
 *       200:
 *         description: Lista de matrículas
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
        const list = await ctrl.listEnrollmentsWithUsers();
        response.success(req, res, list, 200);
    } catch (error) {
        response.error(req, res, error.message, 500);
    }
});

/**
 * @swagger
 * /enrollments/update_log:
 *   post:
 *     summary: Actualizar log de matrícula
 *     tags: [Enrollments]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               id:                   { type: integer }
 *               moodle_enrollment_id: { type: integer }
 *     responses:
 *       200:
 *         description: Log actualizado
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
router.post('/update_log', async (req, res) => {
    try {
        await ctrl.updateElement(req.body);
        response.success(req, res, 'Log actualizado', 200);
    } catch (error) {
        response.error(req, res, error.message, 500);
    }
});

// ─── RUTA SICAU ───────────────────────────────────────────────────────────────

/**
 * @swagger
 * /enrollments/sicau:
 *   post:
 *     summary: Guardar matrículas provenientes del sistema SICAU
 *     tags: [Enrollments]
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
router.post('/sicau', async (req, res, next) => {
    try {
        const items = req.body.enrollments || req.body.items || req.body || [];
        const lista = Array.isArray(items) ? items : [items];
        console.log('SICAU items recibidos:', JSON.stringify(lista, null, 2));
        const results = [];
        for (const enr of lista) {
            const result = await ctrl.saveSicauMatricula(enr);
            console.log('Resultado:', result);
            results.push(result);
        }
        response.success(req, res, { results }, 200);
    } catch (error) {
        next(error);
    }
});

/**
 * @swagger
 * /enrollments/preview:
 *   get:
 *     summary: Vista previa de matrículas con datos de usuario
 *     tags: [Enrollments]
 *     responses:
 *       200:
 *         description: Lista de matrículas con datos de usuario
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
router.get('/preview', async (req, res, next) => {
    try {
        const result = await ctrl.listEnrollmentsWithUsers();
        response.success(req, res, result, 200);
    } catch (error) {
        next(error);
    }
});

// ─── SYNC ─────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /enrollments/sync/preview:
 *   post:
 *     summary: Vista previa de matrículas a sincronizar con estado real de Moodle
 *     tags: [Enrollments]
 *     responses:
 *       200:
 *         description: Lista de matrículas con estado de sincronización
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
        const result = await syncService.previewEnrollments();
        response.success(req, res, result, 200);
    } catch (error) {
        next(error);
    }
});

/**
 * @swagger
 * /enrollments/sync:
 *   post:
 *     summary: Sincronizar matrículas seleccionadas con Moodle
 *     tags: [Enrollments]
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
        const result = await syncService.syncEnrollments(req.body.items || []);
        response.success(req, res, result || 'Datos cargados correctamente', 200);
    } catch (error) {
        next(error);
    }
});

module.exports = router;