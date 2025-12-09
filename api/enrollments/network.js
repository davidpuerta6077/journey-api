const { Router } = require('express');
const router = Router();
const response = require('../../network/response');
const config = require('../../config');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const xlsx = require('xlsx'); 
const https = require('https'); // Necesario para el agente SSL

// Importamos el controlador genérico
const ctrl = require('./index'); 
const tableInjected = 'test';

// URL de Moodle
const MOODLE_WEBSERVICE_URL = "https://moodle50.pascualbravovirtual.edu.co/webservice/rest/server.php";

// ======================================================================
// CONFIGURACIÓN SSL (SOLUCIÓN AL ERROR)
// ======================================================================
// Creamos un agente que ignora la validación del certificado autofirmado
const agent = new https.Agent({  
    rejectUnauthorized: false
});

// ======================================================================
// FUNCIONES AUXILIARES
// ======================================================================

// --- Función para hacer peticiones a Moodle ---
async function callMoodle(url, params) {
    try {
        // AQUI ESTA EL CAMBIO IMPORTANTE: Agregamos httpsAgent: agent
        const res = await axios.post(url, null, { 
            params: params,
            httpsAgent: agent 
        });

        if (res.data && res.data.exception) {
            throw new Error(res.data.message);
        }
        return res.data;
    } catch (error) {
        console.error('Error en llamada a Moodle:', error.message);
        // Mejor manejo del mensaje de error
        const msg = error.response ? (error.response.data.error || error.message) : error.message;
        throw new Error(msg);
    }
}

// --- Leer Excel ---
function readExcel(filePath) {
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    return xlsx.utils.sheet_to_json(worksheet, { defval: '' });
}

// --- Generar Excel de Errores ---
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

// --- Buscadores de IDs en Moodle ---
async function getUserIdByEmail(email, moodleToken) {
    const params = {
        'wstoken': moodleToken,
        'wsfunction': 'core_user_get_users_by_field',
        'moodlewsrestformat': 'json',
        'field': 'email',
        'values[0]': email
    };
    try {
        const result = await callMoodle(MOODLE_WEBSERVICE_URL, params);
        if (result && Array.isArray(result) && result.length > 0) {
            return result[0].id;
        }
        return null;
    } catch (error) {
        return null;
    }
}

async function getCourseIdByCode(code, moodleToken) {
    const params = {
        'wstoken': moodleToken,
        'wsfunction': 'core_course_get_courses',
        'moodlewsrestformat': 'json',
    };
    try {
        const allCourses = await callMoodle(MOODLE_WEBSERVICE_URL, params);
        // Busca coincidencia en idnumber (recomendado) o shortname
        const course = allCourses.find(c => String(c.idnumber) === String(code) || String(c.shortname) === String(code));
        return course ? course.id : null;
    } catch (error) {
        return null;
    }
}

async function getRoleIdByName(roleName, moodleToken) {
    const inputName = roleName ? String(roleName).trim().toLowerCase() : 'student';
    
    const staticRoleMap = {
        'manager': 1, 'gestor': 1,
        'coursecreator': 2, 'creador': 2,
        'editingteacher': 3, 'profesor': 3, 'docente': 3,
        'teacher': 4, 'profesor sin permisos': 4,
        'student': 5, 'estudiante': 5, 'alumno': 5, 'aprendiz': 5,
        'guest': 6, 'invitado': 6
    };

    if (staticRoleMap[inputName]) return staticRoleMap[inputName];
    return 5; // Default estudiante
}

// --- Crear Usuario ---
async function createUserInMoodle(userData, moodleToken) {
    const params = {
        'wstoken': moodleToken,
        'wsfunction': 'core_user_create_users',
        'moodlewsrestformat': 'json',
        'users[0][username]': userData.email.toLowerCase(), 
        'users[0][password]': 'Pascual2025*', 
        'users[0][firstname]': userData.name || 'Sin Nombre',
        'users[0][lastname]': userData.last_name || 'Sin Apellido',
        'users[0][email]': userData.email,
        'users[0][auth]': 'manual',
        'users[0][idnumber]': userData.document || '', 
        'users[0][city]': userData.departamento || 'Medellín',
        'users[0][country]': 'CO'
    };

    try {
        const response = await callMoodle(MOODLE_WEBSERVICE_URL, params);
        
        if (Array.isArray(response) && response.length > 0) {
            return response[0].id;
        } else {
            throw new Error("Moodle no devolvió el ID del usuario creado.");
        }
    } catch (error) {
        throw new Error(`Error creando usuario: ${error.message}`);
    }
}

// --- Matricular Usuario ---
async function enrolUserInMoodle(userId, courseId, roleId, moodleToken) {
    const params = {
        'wstoken': moodleToken,
        'wsfunction': 'enrol_manual_enrol_users',
        'moodlewsrestformat': 'json',
        'enrolments[0][userid]': userId,
        'enrolments[0][courseid]': courseId,
        'enrolments[0][roleid]': roleId
    };

    try {
        const response = await callMoodle(MOODLE_WEBSERVICE_URL, params);
        if (response && response.exception) {
            return { success: false, error: response.message };
        }
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// --- Suspender Usuario ---
async function suspendUserInMoodle(userId, courseId, moodleToken) {
    const params = {
        'wstoken': moodleToken,
        'wsfunction': 'enrol_manual_enrol_users',
        'moodlewsrestformat': 'json',
        'enrolments[0][userid]': userId,
        'enrolments[0][courseid]': courseId,
        'enrolments[0][roleid]': 5, 
        'enrolments[0][suspend]': 1 
    };

    try {
        const response = await callMoodle(MOODLE_WEBSERVICE_URL, params);
        if (response && response.exception) {
            return { success: false, error: response.message };
        }
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// ======================================================================
// LÓGICA DE PROCESAMIENTO (Excel)
// ======================================================================

async function processExcelAndEnrolUsers(filePath, moodleToken) {
    const excelData = readExcel(filePath);
    const errors = [];
    let successCount = 0;
    let errorCount = 0;

    for (const row of excelData) {
        const rowErrors = [];
        const email = String(row.email || '').trim();
        const code = String(row.code || '').trim();
        const roleName = String(row.rol || 'estudiante').trim();

        if (!email) rowErrors.push('Falta email');
        if (!code) rowErrors.push('Falta código curso');

        if (rowErrors.length > 0) {
            errors.push({ ...row, errors: rowErrors.join(', ') });
            errorCount++;
            continue;
        }

        try {
            const courseId = await getCourseIdByCode(code, moodleToken);
            const roleId = await getRoleIdByName(roleName, moodleToken);

            if (!courseId) {
                errors.push({ ...row, errors: `Curso no encontrado: ${code}` });
                errorCount++;
                continue;
            }

            let userId = await getUserIdByEmail(email, moodleToken);

            if (!userId) {
                if (row.name && row.last_name) {
                    try {
                        userId = await createUserInMoodle(row, moodleToken);
                    } catch (createError) {
                        errors.push({ ...row, errors: `No existe y falló al crear: ${createError.message}` });
                        errorCount++;
                        continue; 
                    }
                } else {
                    errors.push({ ...row, errors: 'Usuario no existe y faltan datos (name, last_name) para crearlo.' });
                    errorCount++;
                    continue;
                }
            }

            const enrolResult = await enrolUserInMoodle(userId, courseId, roleId, moodleToken);
            
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

async function processExcelAndSuspendUsers(filePath, moodleToken) {
    const excelData = readExcel(filePath);
    const errors = [];
    let successCount = 0;
    let errorCount = 0;

    for (const row of excelData) {
        const email = String(row.usuario || row.email || '').trim();
        const code = String(row.curso || row.code || '').trim();

        if (!email || !code) {
            errors.push({ ...row, errors: 'Faltan datos (usuario o curso)' });
            errorCount++;
            continue;
        }

        try {
            const userId = await getUserIdByEmail(email, moodleToken);
            const courseId = await getCourseIdByCode(code, moodleToken);

            if (!userId) {
                errors.push({ ...row, errors: `Usuario no encontrado: ${email}` });
                errorCount++;
                continue;
            }
            if (!courseId) {
                errors.push({ ...row, errors: `Curso no encontrado: ${code}` });
                errorCount++;
                continue;
            }

            const result = await suspendUserInMoodle(userId, courseId, moodleToken);

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


// ======================================================================
// RUTAS (Endpoints)
// ======================================================================

router.post('/enroll_users', async (req, res) => {
    try {
        const { userid, courseid, roleid } = req.body;
        const result = await enrolUserInMoodle(userid, courseid, roleid, config.moodle_token);
        if (result.success) {
            response.success(req, res, "Usuario matriculado correctamente", 200);
        } else {
            response.error(req, res, result.error, 400);
        }
    } catch (error) {
        response.error(req, res, error.message, 500);
    }
});

router.post('/unenroll_users', async (req, res) => {
    const data = {
        'wstoken': config.moodle_token,
        'wsfunction': 'enrol_manual_unenrol_users',
        'moodlewsrestformat': 'json',
        'enrolments[0][roleid]': req.body.roleid,
        'enrolments[0][userid]': req.body.userid,
        'enrolments[0][courseid]': req.body.courseid
    }
    try {
        await callMoodle(MOODLE_WEBSERVICE_URL, data);
        response.success(req, res, "Usuario desmatriculado", 200);
    } catch (error) {
        response.error(req, res, error.message, 500);
    }
});

router.post('/upload-excel', async (req, res) => {
    if (!req.files || Object.keys(req.files).length === 0) {
        return response.error(req, res, 'No se ha subido ningún archivo.', 400);
    }

    let excelFile = req.files.excel;
    const uploadPath = path.join(__dirname, '../../uploads', `upload_${Date.now()}_${excelFile.name}`);

    try {
        const dir = path.dirname(uploadPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

        await excelFile.mv(uploadPath);
        response.success(req, res, { message: 'Archivo subido con éxito', filePath: uploadPath }, 200);
    } catch (err) {
        console.error(err);
        response.error(req, res, 'Error al subir el archivo.', 500);
    }
});

router.post('/process-excel', async (req, res) => {
    const { filePath } = req.body;

    if (!filePath) {
        return response.error(req, res, 'No se ha especificado la ruta.', 400);
    }

    try {
        const result = await processExcelAndEnrolUsers(filePath, config.moodle_token);

        if (result.errors.length > 0) {
            const errorExcelPath = await generateErrorExcel(result.errors);
            response.success(req, res, {
                message: 'Proceso de matrículas con errores.',
                successCount: result.successCount,
                errorCount: result.errorCount,
                errorFileUrl: `/uploads/${path.basename(errorExcelPath)}`
            }, 200);
        } else {
            response.success(req, res, { message: 'Matrículas exitosas.', successCount: result.successCount }, 200);
        }
    } catch (error) {
        console.error("Error matrículas:", error);
        response.error(req, res, `Error procesando matrículas: ${error.message}`, 500);
    } finally {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath); 
    }
});

router.post('/process-novedades', async (req, res) => {
    const { filePath } = req.body;

    if (!filePath) {
        return response.error(req, res, 'No se ha especificado la ruta.', 400);
    }

    try {
        const result = await processExcelAndSuspendUsers(filePath, config.moodle_token); 

        if (result.errors.length > 0) {
            const errorExcelPath = await generateErrorExcel(result.errors);
            response.success(req, res, {
                message: 'Proceso de novedades completado con errores.',
                successCount: result.successCount,
                errorCount: result.errorCount,
                errorFileUrl: `/uploads/${path.basename(errorExcelPath)}`
            }, 200);
        } else {
            response.success(req, res, { message: 'Usuarios suspendidos con éxito.', successCount: result.successCount }, 200);
        }
    } catch (error) {
        console.error("Error novedades:", error);
        response.error(req, res, `Error procesando novedades: ${error.message}`, 500);
    } finally {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath); 
    }
});

router.get('/list', async (req, res) => {
    try {
        const list = await ctrl.list(tableInjected);
        response.success(req, res, list, 200);
    } catch (error) {
        response.error(req, res, error.message, 500);
    }
})

router.post('/add', async (req, res) => {
    try {
        await ctrl.addElement(tableInjected, { "data": req.body.data });
        response.success(req, res, `Item Created`, 200);
    } catch (error) {
        response.error(req, res, error.message, 500);
    }
});

router.put('/update', async (req, res) => {
    try {
        let { id, data } = req.body;
        await ctrl.updateElement(tableInjected, { "id": id, "data": data });
        response.success(req, res, `Item updated`, 200);
    } catch (error) {
        response.error(req, res, error.message, 500);
    }
});


router.post('/update_log', async (req, res) => {
    try {
        await ctrl.updateElement("logs", req.body)
        response.success(req, res, `Item Created`, 200);
    } catch (error) {
        response.error(req, res, error.message, 500);
    }
});


module.exports = router;