module.exports = (injectedDB) => {
    
    
    let data = injectedDB

    function list(TABLA) {
        return data.listAllRemote(TABLA);
    };

 
    
    async function addElement (TABLA, datas) {
        return data.insertItem(TABLA, datas)
    };

    async function updateElement (TABLA, datas) {
        return data.updateItem(TABLA, datas)
    };

    return {
        list,
        addElement, 
        updateElement
    };
};

// api/users/controller.js
const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');
const axios = require('axios');

// URL de tu Moodle (puedes sacarla de config.js o directamente aquí si es fija)
const MOODLE_WEBSERVICE_URL = "https://moodle50.pascualbravovirtual.edu.co/webservice/rest/server.php";

// --- Función addService ---
async function addService(url, data) {
    try {
        const response = await axios.post(url, null, { params: data });
        return response.data;
    } catch (error) {
        console.error('Error en addService:', error.response ? error.response.data : error.message);
        throw new Error(error.response ? (error.response.data.error || 'Error en el servicio externo') : 'Error de conexión');
    }
}
// -------------------------------------------------

// Función para leer el archivo Excel
function readExcel(filePath) {
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0]; // Asume la primera hoja
    const worksheet = workbook.Sheets[sheetName];
    // Asegúrate de que los valores se lean como cadenas si es posible, o manéjalos después
    const data = xlsx.utils.sheet_to_json(worksheet, { defval: '' }); // defval: '' asigna cadena vacía por defecto
    return data;
}

// Función para validar un usuario (ejemplo básico)
function validateUser(userData) {
    const errors = [];

    // Normalizar los campos importantes a string antes de la validación
    // Esto es CRÍTICO para el error `trim is not a function`
    userData.name = (userData.name != null) ? String(userData.name).trim() : '';
    userData.last_name = (userData.last_name != null) ? String(userData.last_name).trim() : '';
    userData.document = (userData.document != null) ? String(userData.document).trim() : ''; // <-- Aquí la corrección principal
    userData.email = (userData.email != null) ? String(userData.email).trim() : '';


    if (!userData.name) errors.push('El nombre es obligatorio.');
    if (!userData.last_name) errors.push('El apellido es obligatorio.');
    if (!userData.document) errors.push('El documento es obligatorio.');
    if (!userData.email || !/\S+@\S+\.\S+/.test(userData.email)) errors.push('El email es inválido o no existe.');

    // Aquí la modificación: el password será el documento
    if (!userData.document) {
        errors.push('No se puede generar la contraseña, el documento es inválido o no existe.');
    } else {
        userData.password = userData.document; // Asignar el documento como contraseña
    }

    if (!userData.username) userData.username = userData.email;

    return errors;
}

// Función principal para procesar el Excel y crear usuarios
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
            const userDataForMoodle = {
                'wstoken': moodleToken,
                'wsfunction': 'core_user_create_users',
                'moodlewsrestformat': 'json',
                'users[0][username]': row.username || row.email,
                'users[0][firstname]': row.name,
                'users[0][lastname]': row.last_name,
                'users[0][email]': row.email,
                'users[0][password]': row.password,
                'users[0][city]': row.city || 'Desconocido',
                'users[0][country]': row.country || 'CO',
                'users[0][idnumber]': row.document,
            };

            try {
                const moodleResult = await addService(MOODLE_WEBSERVICE_URL, userDataForMoodle);

                if (moodleResult && Array.isArray(moodleResult) && moodleResult.length > 0) {
                    successCount++;
                } else if (moodleResult && moodleResult.exception) {
                    errors.push({ ...row, errors: `Error de Moodle: ${moodleResult.message || 'Error desconocido'}` });
                    errorCount++;
                } else {
                    errors.push({ ...row, errors: `Respuesta inesperada de Moodle: ${JSON.stringify(moodleResult)}` });
                    errorCount++;
                }
            } catch (moodleApiError) {
                console.error(`Error al enviar usuario a Moodle (${row.email}):`, moodleApiError.message);
                errors.push({ ...row, errors: `Error en la API de Moodle: ${moodleApiError.message}` });
                errorCount++;
            }
        }
    }
    return { successCount, errorCount, errors };
}

// Nueva función para crear un solo usuario en Moodle (para el endpoint /add_user)
async function createSingleMoodleUser(userData) {
    // Normalizar los campos importantes a string antes de la validación
    userData.document = (userData.document != null) ? String(userData.document).trim() : '';
    userData.email = (userData.email != null) ? String(userData.email).trim() : '';
    userData.username = (userData.username != null) ? String(userData.username).trim() : '';
    userData.firstname = (userData.firstname != null) ? String(userData.firstname).trim() : '';
    userData.lastname = (userData.lastname != null) ? String(userData.lastname).trim() : '';


    if (!userData.document) {
        throw new Error('El documento es requerido para generar la contraseña.');
    }
    userData.password = userData.document;
    if (!userData.username) userData.username = userData.email;


    const dataForMoodle = {
        'wstoken': userData.wstoken,
        'wsfunction': 'core_user_create_users',
        'moodlewsrestformat': 'json',
        'users[0][username]': userData.username,
        'users[0][firstname]': userData.firstname,
        'users[0][lastname]': userData.lastname,
        'users[0][email]': userData.email,
        'users[0][password]': userData.password,
        'users[0][city]': userData.city || 'Desconocido',
        'users[0][country]': userData.country || 'CO',
        'users[0][idnumber]': userData.document,
    };

    try {
        const moodleResult = await addService(MOODLE_WEBSERVICE_URL, dataForMoodle);
        if (moodleResult && Array.isArray(moodleResult) && moodleResult.length > 0) {
            return { success: true, userId: moodleResult[0].id, response: moodleResult };
        } else if (moodleResult && moodleResult.exception) {
            throw new Error(`Error de Moodle: ${moodleResult.message || 'Error desconocido'}`);
        } else {
            throw new Error(`Respuesta inesperada de Moodle: ${JSON.stringify(moodleResult)}`);
        }
    } catch (error) {
        console.error('Error en createSingleMoodleUser:', error.message);
        throw error;
    }
}


// Función para generar el archivo Excel de errores
async function generateErrorExcel(errors) {
    if (errors.length === 0) {
        return null;
    }

    const ws = xlsx.utils.json_to_sheet(errors);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, 'Errores de Carga');

    const fileName = `errores_carga_usuarios_${Date.now()}.xlsx`;
    const outputPath = path.join(__dirname, '../../uploads', fileName);
    xlsx.writeFile(wb, outputPath);
    return outputPath;
}

module.exports = {
    processExcelAndCreateUsers,
    generateErrorExcel,
    createSingleMoodleUser,
};