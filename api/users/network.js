const { Router } = require('express');
const router = Router();
const response = require('../../network/response');
const ctrl = require('./index');
const { moodleRequest } = require('../../services/moodleService');
const syncService = require('../../services/syncService');
const path = require('path');
const fs = require('fs');

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

router.post('/process-excel', async (req, res) => {
    const { filePath } = req.body;
    if (!filePath) return response.error(req, res, 'No se ha especificado la ruta del archivo.', 400);
    try {
        const result = await ctrl.processExcelAndCreateUsers(filePath);
        if (result.errors.length > 0) {
            const errorExcelPath = await ctrl.generateErrorExcel(result.errors);
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

router.post('/sync/preview', async (req, res, next) => {
    try {
        const result = await syncService.previewStudents();
        response.success(req, res, result, 200);
    } catch (error) {
        next(error);
    }
});

router.post('/sync', async (req, res, next) => {
    try {
        const result = await syncService.syncStudents(req.body.items || []);
        response.success(req, res, result || 'Datos cargados correctamente', 200);
    } catch (error) {
        next(error);
    }
});
// ─── MÓDULOS ──────────────────────────────────────────────────────────────────

router.post('/journey', async (req, res, next) => {
    try {
        const result = await ctrl.saveJourneyUsuario(req.body);
        response.success(req, res, result, 201);
    } catch (error) {
        next(error);
    }
});

router.post('/reset-password/:id', async (req, res, next) => {
    try {
        const result = await ctrl.resetUserPassword(req.params.id);
        response.success(req, res, result, 200);
    } catch (error) {
        next(error);
    }
});

router.get('/:id/enrollments', async (req, res, next) => {
    try {
        const result = await ctrl.getUserEnrollments(req.params.id);
        response.success(req, res, result, 200);
    } catch (error) {
        next(error);
    }
});

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