const { Router } = require('express');
const router = Router();
const response = require('../../network/response');
const ctrl = require('./index');
const { moodleRequest } = require('../../services/moodleService');
const syncService = require('../../services/syncService');
const path = require('path');
const fs = require('fs');

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
    xlsx.utils.book_append_sheet(wb, ws, 'Errores de Carga');
    const fileName = `errores_carga_usuarios_${Date.now()}.xlsx`;
    const outputPath = path.join(__dirname, '../../uploads', fileName);
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    xlsx.writeFile(wb, outputPath);
    return outputPath;
}

function validateUser(userData) {
    const errors = [];
    userData.name      = (userData.name      != null) ? String(userData.name).trim()      : '';
    userData.last_name = (userData.last_name  != null) ? String(userData.last_name).trim() : '';
    userData.document  = (userData.document   != null) ? String(userData.document).trim()  : '';
    userData.email     = (userData.email      != null) ? String(userData.email).trim()     : '';
    if (!userData.name)      errors.push('El nombre es obligatorio.');
    if (!userData.last_name) errors.push('El apellido es obligatorio.');
    if (!userData.document)  errors.push('El documento es obligatorio.');
    if (!userData.email || !/\S+@\S+\.\S+/.test(userData.email)) errors.push('El email es inválido.');
    if (!userData.document) {
        errors.push('No se puede generar la contraseña.');
    } else {
        userData.password = userData.document;
    }
    if (!userData.username) userData.username = userData.email;
    return errors;
}

async function processExcelAndCreateUsers(filePath) {
    const excelData = readExcel(filePath);
    const errors = [];
    let successCount = 0;
    let errorCount = 0;

    for (const row of excelData) {
        const validationErrors = validateUser(row);
        if (validationErrors.length > 0) {
            errors.push({ ...row, errors: validationErrors.join(', ') });
            errorCount++;
            continue;
        }
        try {
            const moodleResult = await moodleRequest('core_user_create_users', {
                'users[0][username]':  row.username.toLowerCase(),
                'users[0][firstname]': row.name,
                'users[0][lastname]':  row.last_name,
                'users[0][email]':     row.email,
                'users[0][password]':  row.password,
                'users[0][city]':      row.city    || 'Desconocido',
                'users[0][country]':   row.country || 'CO',
                'users[0][idnumber]':  row.document,
            });
            if (Array.isArray(moodleResult) && moodleResult.length > 0) {
                successCount++;
            } else if (moodleResult && moodleResult.exception) {
                errors.push({ ...row, errors: `Error Moodle: ${moodleResult.message}` });
                errorCount++;
            } else {
                errors.push({ ...row, errors: 'Respuesta inesperada' });
                errorCount++;
            }
        } catch (moodleApiError) {
            errors.push({ ...row, errors: `Error API: ${moodleApiError.message}` });
            errorCount++;
        }
    }
    return { successCount, errorCount, errors };
}

// ─── RUTAS EXCEL ──────────────────────────────────────────────────────────────

// express-fileupload ya está configurado globalmente en index.js
// los archivos llegan en req.files.<nombre_del_campo>
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

router.get('/test', async (req, res) => {
    try {
        const data = await ctrl.list('logs');
        response.success(req, res, { test_message: 'Api Users Working!', table: data }, 200);
    } catch (error) {
        response.error(req, res, error.message, 500);
    }
});

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

router.post(['/sync/preview', '/sync/preview/'], async (req, res, next) => {
    try {
        const result = await syncService.previewStudents();
        response.success(req, res, result, 200);
    } catch (error) {
        next(error);
    }
});

router.post(['/sync', '/sync/'], async (req, res, next) => {
    try {
        const result = await syncService.syncStudents(req.body.items || []);
        response.success(req, res, result || 'Datos cargados correctamente', 200);
    } catch (error) {
        next(error);
    }
});

module.exports = router;