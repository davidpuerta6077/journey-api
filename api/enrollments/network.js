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

// ─── HELPERS MOODLE ───────────────────────────────────────────────────────────

async function getUserIdByEmail(email) {
    try {
        const result = await moodleRequest('core_user_get_users_by_field', {
            'field':     'email',
            'values[0]': email
        });
        if (result && Array.isArray(result) && result.length > 0) return result[0].id;
        return null;
    } catch { return null; }
}

async function getCourseIdByCode(code) {
    try {
        const allCourses = await moodleRequest('core_course_get_courses', {});
        const course = allCourses.find(c => String(c.idnumber) === String(code) || String(c.shortname) === String(code));
        return course ? course.id : null;
    } catch { return null; }
}

async function getRoleIdByName(roleName) {
    const inputName = roleName ? String(roleName).trim().toLowerCase() : 'student';
    const staticRoleMap = {
        'manager': 1, 'gestor': 1,
        'coursecreator': 2, 'creador': 2,
        'editingteacher': 3, 'profesor': 3, 'docente': 3,
        'teacher': 4, 'profesor sin permisos': 4,
        'student': 5, 'estudiante': 5, 'alumno': 5, 'aprendiz': 5,
        'guest': 6, 'invitado': 6
    };
    return staticRoleMap[inputName] || 5;
}

async function createUserInMoodle(userData) {
    const res = await moodleRequest('core_user_create_users', {
        'users[0][username]':  userData.email.toLowerCase(),
        'users[0][password]':  'Pascual2025*',
        'users[0][firstname]': userData.name      || 'Sin Nombre',
        'users[0][lastname]':  userData.last_name || 'Sin Apellido',
        'users[0][email]':     userData.email,
        'users[0][auth]':      'manual',
        'users[0][idnumber]':  userData.document  || '',
        'users[0][city]':      userData.departamento || 'Medellín',
        'users[0][country]':   'CO'
    });
    if (Array.isArray(res) && res.length > 0) return res[0].id;
    throw new Error('Moodle no devolvió el ID del usuario creado.');
}

async function enrolUserInMoodle(userId, courseId, roleId) {
    try {
        const res = await moodleRequest('enrol_manual_enrol_users', {
            'enrolments[0][userid]':   userId,
            'enrolments[0][courseid]': courseId,
            'enrolments[0][roleid]':   roleId
        });
        if (res && res.exception) return { success: false, error: res.message };
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

async function suspendUserInMoodle(userId, courseId) {
    try {
        const res = await moodleRequest('enrol_manual_enrol_users', {
            'enrolments[0][userid]':   userId,
            'enrolments[0][courseid]': courseId,
            'enrolments[0][roleid]':   5,
            'enrolments[0][suspend]':  1
        });
        if (res && res.exception) return { success: false, error: res.message };
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

async function processExcelAndEnrolUsers(filePath) {
    const excelData = readExcel(filePath);
    const errors = [];
    let successCount = 0;
    let errorCount = 0;

    for (const row of excelData) {
        const rowErrors = [];
        const email    = String(row.email || '').trim();
        const code     = String(row.code  || '').trim();
        const roleName = String(row.rol   || 'estudiante').trim();

        if (!email) rowErrors.push('Falta email');
        if (!code)  rowErrors.push('Falta código curso');

        if (rowErrors.length > 0) {
            errors.push({ ...row, errors: rowErrors.join(', ') });
            errorCount++;
            continue;
        }

        try {
            const courseId = await getCourseIdByCode(code);
            const roleId   = await getRoleIdByName(roleName);

            if (!courseId) {
                errors.push({ ...row, errors: `Curso no encontrado: ${code}` });
                errorCount++;
                continue;
            }

            let userId = await getUserIdByEmail(email);
            if (!userId) {
                if (row.name && row.last_name) {
                    try {
                        userId = await createUserInMoodle(row);
                    } catch (createError) {
                        errors.push({ ...row, errors: `No existe y falló al crear: ${createError.message}` });
                        errorCount++;
                        continue;
                    }
                } else {
                    errors.push({ ...row, errors: 'Usuario no existe y faltan datos para crearlo.' });
                    errorCount++;
                    continue;
                }
            }

            const enrolResult = await enrolUserInMoodle(userId, courseId, roleId);
            if (enrolResult.success) {
                successCount++;
            } else {
                errors.push({ ...row, errors: `Fallo al matricular: ${enrolResult.error}` });
                errorCount++;
            }
        } catch (generalError) {
            errors.push({ ...row, errors: `Error inesperado: ${generalError.message}` });
            errorCount++;
        }
    }
    return { successCount, errorCount, errors };
}

async function processExcelAndSuspendUsers(filePath) {
    const excelData = readExcel(filePath);
    const errors = [];
    let successCount = 0;
    let errorCount = 0;

    for (const row of excelData) {
        const email = String(row.usuario || row.email || '').trim();
        const code  = String(row.curso   || row.code  || '').trim();

        if (!email || !code) {
            errors.push({ ...row, errors: 'Faltan datos (usuario o curso)' });
            errorCount++;
            continue;
        }

        try {
            const userId   = await getUserIdByEmail(email);
            const courseId = await getCourseIdByCode(code);

            if (!userId)   { errors.push({ ...row, errors: `Usuario no encontrado: ${email}` }); errorCount++; continue; }
            if (!courseId) { errors.push({ ...row, errors: `Curso no encontrado: ${code}` });    errorCount++; continue; }

            const result = await suspendUserInMoodle(userId, courseId);
            if (result.success) {
                successCount++;
            } else {
                errors.push({ ...row, errors: `Error Moodle: ${result.error}` });
                errorCount++;
            }
        } catch (err) {
            errors.push({ ...row, errors: `Error interno: ${err.message}` });
            errorCount++;
        }
    }
    return { successCount, errorCount, errors };
}

// ─── RUTAS MOODLE ─────────────────────────────────────────────────────────────

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

router.get('/list', async (req, res) => {
    try {
        const list = await ctrl.listEnrollmentsWithUsers();
        response.success(req, res, list, 200);
    } catch (error) {
        response.error(req, res, error.message, 500);
    }
});

router.post('/update_log', async (req, res) => {
    try {
        await ctrl.updateElement(req.body);
        response.success(req, res, 'Log actualizado', 200);
    } catch (error) {
        response.error(req, res, error.message, 500);
    }
});

// ─── RUTA SICAU ───────────────────────────────────────────────────────────────
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

// ─── PREVIEW MATRÍCULAS CON DATOS DE USUARIO ─────────────────────────────────
router.get('/preview', async (req, res, next) => {
    try {
        const result = await ctrl.listEnrollmentsWithUsers();
        response.success(req, res, result, 200);
    } catch (error) {
        next(error);
    }
});

// ─── SYNC ─────────────────────────────────────────────────────────────────────

router.post(['/sync/preview', '/sync/preview/'], async (req, res, next) => {
    try {
        const result = await syncService.previewEnrollments();
        response.success(req, res, result, 200);
    } catch (error) {
        next(error);
    }
});

router.post(['/sync', '/sync/'], async (req, res, next) => {
    try {
        const result = await syncService.syncEnrollments(req.body.items || []);
        response.success(req, res, result || 'Datos cargados correctamente', 200);
    } catch (error) {
        next(error);
    }
});

module.exports = router;