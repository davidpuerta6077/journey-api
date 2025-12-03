const { Router } = require('express');
const router = Router();
const response = require('../../network/response');
const config = require('../../config');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const xlsx = require('xlsx'); 
const https = require('https'); // Importante para arreglar el error SSL

// Importamos el controlador genérico
const ctrl = require('./index'); 

const MOODLE_WEBSERVICE_URL = "https://moodle50.pascualbravovirtual.edu.co/webservice/rest/server.php";

// ======================================================================
// CONFIGURACIÓN SSL (SOLUCIÓN AL ERROR)
// ======================================================================
// Creamos el agente para ignorar errores de certificado (self-signed)
const agent = new https.Agent({  
    rejectUnauthorized: false
});

// ======================================================================
// FUNCIONES AUXILIARES
// ======================================================================

// --- Función genérica para llamar a Moodle ---
async function callMoodle(url, params) {
    try {
        // AQUI AGREGAMOS EL AGENTE SSL
        const res = await axios.post(url, null, { 
            params: params,
            httpsAgent: agent // <--- Esto permite la conexión segura aunque el certificado falle
        });
        
        if (res.data && res.data.exception) {
            throw new Error(res.data.message);
        }
        return res.data;
    } catch (error) {
        console.error('Error en llamada a Moodle:', error.message);
        // Mejoramos el mensaje de error para depuración
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
    xlsx.utils.book_append_sheet(wb, ws, 'Errores de Carga');

    const fileName = `errores_carga_usuarios_${Date.now()}.xlsx`;
    const outputPath = path.join(__dirname, '../../uploads', fileName);
    
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    xlsx.writeFile(wb, outputPath);
    return outputPath;
}

// --- Validar Usuario (Lógica de Negocio) ---
function validateUser(userData) {
    const errors = [];

    // Normalizar a string para evitar errores de .trim()
    userData.name = (userData.name != null) ? String(userData.name).trim() : '';
    userData.last_name = (userData.last_name != null) ? String(userData.last_name).trim() : '';
    userData.document = (userData.document != null) ? String(userData.document).trim() : ''; 
    userData.email = (userData.email != null) ? String(userData.email).trim() : '';

    if (!userData.name) errors.push('El nombre es obligatorio.');
    if (!userData.last_name) errors.push('El apellido es obligatorio.');
    if (!userData.document) errors.push('El documento es obligatorio.');
    if (!userData.email || !/\S+@\S+\.\S+/.test(userData.email)) errors.push('El email es inválido o no existe.');

    // Asignar el documento como contraseña (Regla de negocio)
    if (!userData.document) {
        errors.push('No se puede generar la contraseña, el documento es inválido.');
    } else {
        userData.password = userData.document; 
    }

    // Username por defecto es el email si no viene
    if (!userData.username) userData.username = userData.email;

    return errors;
}

// --- Procesar Excel y Crear Usuarios ---
async function processExcelAndCreateUsers(filePath, moodleToken) {
    const excelData = readExcel(filePath);
    const errors = [];
    let successCount = 0;
    let errorCount = 0;

    for (const row of excelData) {
        
        const validationErrors = validateUser(row);

        if (validationErrors.length > 0) {
            errors.push({ ...row, errors: validationErrors.join(', ') });
            errorCount++;
        } else {
            // Datos listos para Moodle
            const userDataForMoodle = {
                'wstoken': moodleToken,
                'wsfunction': 'core_user_create_users',
                'moodlewsrestformat': 'json',
                'users[0][username]': row.username.toLowerCase(),
                'users[0][firstname]': row.name,
                'users[0][lastname]': row.last_name,
                'users[0][email]': row.email,
                'users[0][password]': row.password, // Es el documento
                'users[0][city]': row.city || 'Desconocido',
                'users[0][country]': row.country || 'CO',
                'users[0][idnumber]': row.document,
            };

            try {
                const moodleResult = await callMoodle(MOODLE_WEBSERVICE_URL, userDataForMoodle);

                if (Array.isArray(moodleResult) && moodleResult.length > 0) {
                    successCount++;
                } else if (moodleResult && moodleResult.exception) {
                    errors.push({ ...row, errors: `Error Moodle: ${moodleResult.message}` });
                    errorCount++;
                } else {
                    errors.push({ ...row, errors: `Respuesta inesperada: ${JSON.stringify(moodleResult)}` });
                    errorCount++;
                }
            } catch (moodleApiError) {
                errors.push({ ...row, errors: `Error API: ${moodleApiError.message}` });
                errorCount++;
            }
        }
    }
    return { successCount, errorCount, errors };
}

// ======================================================================
// RUTAS (ENDPOINTS)
// ======================================================================

// 1. Crear usuario manual (Single)
router.post('/add_user', async (req, res) => {
    const data = {
        'wstoken': config.moodle_token, 
        'wsfunction': 'core_user_create_users', 
        'moodlewsrestformat': 'json', 

        'users[0][username]': req.body.username || req.body.email,
        'users[0][firstname]': req.body.firstname,
        'users[0][lastname]': req.body.lastname,
        'users[0][email]': req.body.email,
        'users[0][password]': req.body.password, 
        'users[0][city]': req.body.city || 'Medellin',
        'users[0][country]': req.body.country || 'CO',
        'users[0][idnumber]': req.body.document || ''
    };

    try {
        const result = await callMoodle(MOODLE_WEBSERVICE_URL, data);
        response.success(req, res, result, 200);    
    } catch (error) {
        response.error(req, res, error.message, 500);
    }
});

// 2. Actualizar usuario
router.post('/update_user', async (req, res) => {
    const data = {
        'wstoken': config.moodle_token, 
        'wsfunction': 'core_user_update_users', 
        'moodlewsrestformat': 'json', 
        'users[0][id]': req.body.id
    };
    
    if(req.body.firstname) data['users[0][firstname]'] = req.body.firstname;
    if(req.body.lastname) data['users[0][lastname]'] = req.body.lastname;
    if(req.body.email) data['users[0][email]'] = req.body.email;
    if(req.body.password) data['users[0][password]'] = req.body.password;
    if(req.body.city) data['users[0][city]'] = req.body.city;

    try {
        const result = await callMoodle(MOODLE_WEBSERVICE_URL, data);
        response.success(req, res, result || "Usuario actualizado", 200);    
    } catch (error) {
        response.error(req, res, error.message, 500);
    }
});

// 3. Eliminar usuario
router.post('/delete_user', async (req, res) => {
    const data = {
        'wstoken': config.moodle_token, 
        'wsfunction': 'core_user_delete_users', 
        'moodlewsrestformat': 'json', 
        'userids[0]': req.body.userids 
    };

    try {
        const result = await callMoodle(MOODLE_WEBSERVICE_URL, data);
        response.success(req, res, result || "Usuario eliminado", 200);    
    } catch (error) {
        response.error(req, res, error.message, 500);
    }
});

// 4. Buscar usuario
router.post('/search_user', async (req, res) => {
    const data = {
        'wstoken': config.moodle_token, 
        'wsfunction': 'core_user_get_users', 
        'moodlewsrestformat': 'json', 
        'criteria[0][key]': req.body.key,   
        'criteria[0][value]': req.body.value 
    };

    try {
        const result = await callMoodle(MOODLE_WEBSERVICE_URL, data);
        response.success(req, res, result, 200);    
    } catch (error) {
        response.error(req, res, error.message, 500);
    }
});

// 5. Subir Excel (Carga temporal)
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

// 6. Procesar Excel (Lógica local)
router.post('/process-excel', async (req, res) => {
    const { filePath } = req.body;

    if (!filePath) {
        return response.error(req, res, 'No se ha especificado la ruta del archivo.', 400);
    }

    try {
        const result = await processExcelAndCreateUsers(filePath, config.moodle_token);

        if (result.errors.length > 0) {
            const errorExcelPath = await generateErrorExcel(result.errors);
            response.success(req, res, {
                message: 'Proceso completado con errores.',
                successCount: result.successCount,
                errorCount: result.errorCount,
                errorFileUrl: `/uploads/${path.basename(errorExcelPath)}`
            }, 200);
        } else {
            response.success(req, res, { message: 'Usuarios cargados con éxito.', successCount: result.successCount }, 200);
        }
    } catch (error) {
        console.error("Error al procesar:", error);
        response.error(req, res, `Error interno: ${error.message}`, 500);
    } finally {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath); 
        }
    }
});

router.get('/test', async (req, res) => {
    try {
        response.success(req, res, "Api Users Working!", 200);
    } catch (error) {
        response.error(req, res, error.message, 500);
    }
});

module.exports = router;