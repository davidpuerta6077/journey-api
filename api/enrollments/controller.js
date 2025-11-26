
// module.exports = (injectedDB) => {
    
    
//     let data = injectedDB

//     function list(TABLA) {
//         return data.listAllRemote(TABLA);
//     };

 
    
//     async function addElement (TABLA, datas) {
//         return data.insertItem(TABLA, datas)
//     };

//     async function updateElement (TABLA, datas) {
//         return data.updateItem(TABLA, datas)
//     };

//     return {
//         list,
//         addElement, 
//         updateElement
//     };
// };

// api/enrollments/controller.js
const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');
const axios = require('axios'); 

// URL de tu Moodle 
const MOODLE_WEBSERVICE_URL = "https://moodle50.pascualbravovirtual.edu.co/webservice/rest/server.php";

// --- Función addService (Local) ---
async function addService(url, data) {
    try {
        const response = await axios.post(url, null, { params: data });
        return response.data;
    } catch (error) {
        console.error('Error en addService para matrículas:', error.response ? error.response.data : error.message);
        throw new Error(error.response ? (error.response.data.error || 'Error en el servicio externo') : 'Error de conexión');
    }
}

// Función para leer el archivo Excel
function readExcel(filePath) {
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0]; 
    const worksheet = workbook.Sheets[sheetName];
    // Asegurarse de limpiar espacios en blanco de las claves si es necesario
    const data = xlsx.utils.sheet_to_json(worksheet, { defval: '' }); 
    return data;
}

// -----------------------------------------------------------------
// CAMBIO 1: Eliminado el tercer argumento 'addServiceFunction'
// -----------------------------------------------------------------

async function getUserIdByEmail(email, moodleToken) {
    const params = {
        'wstoken': moodleToken,
        'wsfunction': 'core_user_get_users_by_field',
        'moodlewsrestformat': 'json',
        'field': 'email',
        'values[0]': email
    };
    try {
        // CAMBIO: Llamamos directamente a addService
        const result = await addService(MOODLE_WEBSERVICE_URL, params);
        if (result && Array.isArray(result) && result.length > 0) {
            return result[0].id; 
        }
        return null;
    } catch (error) {
        console.error(`Error al obtener ID de usuario para ${email}:`, error.message);
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
        // CAMBIO: Llamamos directamente a addService
        const allCourses = await addService(MOODLE_WEBSERVICE_URL, params);
        // Asegúrate que tu Excel tiene 'code' y en Moodle coincida con idnumber o shortname
        const course = allCourses.find(c => String(c.idnumber) === String(code) || String(c.shortname) === String(code));
        return course ? course.id : null;
    } catch (error) {
        console.error(`Error al obtener ID de curso para ${code}:`, error.message);
        return null;
    }
}


async function getRoleIdByName(roleName, moodleToken) {
    // 1. Normalizamos el nombre (todo a minúsculas y sin espacios extra)
    const inputName = roleName.trim().toLowerCase();


    const staticRoleMap = {
        'manager': 1,
        'gestor': 1,
        'coursecreator': 2,
        'creador': 2,
        'editingteacher': 3,
        'profesor': 3,
        'docente': 3,
        'teacher': 4,
        'profesor sin permisos': 4,
        'student': 5,
        'estudiante': 5,
        'alumno': 5,
        'aprendiz': 5,
        'guest': 6,
        'invitado': 6
    };

    if (staticRoleMap[inputName]) {
        console.log(`Rol encontrado en mapa fijo: "${inputName}" -> ID: ${staticRoleMap[inputName]}`);
        return staticRoleMap[inputName];
    }

   
    console.log(`El rol "${inputName}" no es estándar, buscando en API...`);

    const params = {
        'wstoken': moodleToken,
        'wsfunction': 'core_role_get_assignable_roles', // Función diferente, más fiable
        'moodlewsrestformat': 'json',
        'contextid': 1 // Contexto del sistema
    };

    try {
        const response = await addService(MOODLE_WEBSERVICE_URL, params);
        
        // Esta función devuelve un array directo, no un objeto { roles: ... }
        const roles = Array.isArray(response) ? response : [];

        if (roles.length === 0) {
            console.error("La API devolvió una lista de roles vacía. Verifica los permisos del Token.");
            return null;
        }

        const foundRole = roles.find(r => 
            r.shortname.toLowerCase() === inputName || 
            r.name.toLowerCase() === inputName // El nombre visible (ej: "Estudiante")
        );

        if (foundRole) {
            console.log(`Rol encontrado por API: ${foundRole.shortname} (ID: ${foundRole.id})`);
            return foundRole.id;
        } else {
            console.log(`No se encontró el rol "${inputName}" en la API.`);
            return null;
        }

    } catch (error) {
        console.error(`Error al consultar API de roles:`, error.message);
        return null;
    }
}

// Función para validar una matrícula
async function validateEnrollment(enrollmentData, moodleToken) {
    const errors = [];

    enrollmentData.code = (enrollmentData.code != null) ? String(enrollmentData.code).trim() : ''; 
    enrollmentData.email = (enrollmentData.email != null) ? String(enrollmentData.email).trim() : ''; 
    enrollmentData.rol = (enrollmentData.rol != null) ? String(enrollmentData.rol).trim() : ''; 

    if (!enrollmentData.code) errors.push('El código del curso es obligatorio.');
    if (!enrollmentData.email) errors.push('El email del usuario es obligatorio.');
    if (!enrollmentData.rol) errors.push('El rol es obligatorio.');

    // Si faltan datos básicos, no intentamos buscar en Moodle para ahorrar peticiones
    if (errors.length > 0) return errors;

    // CAMBIO: Ya no pasamos addServiceFunction
    let userId = await getUserIdByEmail(enrollmentData.email, moodleToken);
    let courseId = await getCourseIdByCode(enrollmentData.code, moodleToken);
    let roleId = await getRoleIdByName(enrollmentData.rol, moodleToken);

    if (!userId) errors.push(`No se encontró el usuario con email: ${enrollmentData.email}.`);
    if (!courseId) errors.push(`No se encontró el curso con código: ${enrollmentData.code}.`);
    if (!roleId) errors.push(`No se encontró el rol con nombre: ${enrollmentData.rol}.`);

    enrollmentData.userid = userId;
    enrollmentData.courseid = courseId;
    enrollmentData.roleid = roleId;

    return errors;
}

// Función para matricular un usuario en Moodle
async function enrolUserInMoodle(enrollmentData, moodleToken) {
    const FUNCTION_NAME = 'enrol_manual_enrol_users';

    const params = {
        'wstoken': moodleToken,
        'wsfunction': FUNCTION_NAME,
        'moodlewsrestformat': 'json',
        'enrolments[0][userid]': enrollmentData.userid,
        'enrolments[0][courseid]': enrollmentData.courseid,
        'enrolments[0][roleid]': enrollmentData.roleid,
        'enrolments[0][timestart]': enrollmentData.timestart || 0, 
        'enrolments[0][timeend]': enrollmentData.timeend || 0,   
        'enrolments[0][suspend]': enrollmentData.suspend || 0,   
    };

    try {
        // CAMBIO: Llamamos directamente a addService
        const response = await addService(MOODLE_WEBSERVICE_URL, params);
        
        if (response && response.exception) {
            console.error('Error de Moodle al matricular:', response);
            return { success: false, error: response.message || 'Error desconocido de Moodle' };
        }
        return { success: true };
    } catch (error) {
        console.error('Error en la llamada a la API de Moodle para matrícula:', error.message);
        return { success: false, error: error.message };
    }
}

// Función principal (Nota: quité addServiceFunction de los argumentos)
async function processExcelAndEnrolUsers(filePath, moodleToken) {
    const excelData = readExcel(filePath);
    const errors = [];
    let successCount = 0;
    let errorCount = 0;

    for (const row of excelData) {
        // CAMBIO: Llamada simplificada
        const validationErrors = await validateEnrollment(row, moodleToken);
        
        if (validationErrors.length > 0) {
            errors.push({ ...row, errors: validationErrors.join(', ') });
            errorCount++;
        } else {
            // CAMBIO: Llamada simplificada
            const moodleResult = await enrolUserInMoodle(row, moodleToken);
            if (moodleResult.success) {
                successCount++;
            } else {
                errors.push({ ...row, errors: `Error al matricular en Moodle: ${moodleResult.error}` });
                errorCount++;
            }
        }
    }
    return { successCount, errorCount, errors };
}

// ... Resto del código (generateErrorExcel y module.exports) igual ...
async function generateErrorExcel(errors) {
    if (errors.length === 0) {
        return null;
    }

    const ws = xlsx.utils.json_to_sheet(errors);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, 'Errores de Matrícula');

    const fileName = `errores_carga_matriculas_${Date.now()}.xlsx`;
    // Asegurate que esta ruta exista o usa /tmp si es serverless
    const outputPath = path.join(__dirname, '../../uploads', fileName); 
    
    // Crear carpeta si no existe (opcional)
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)){
        fs.mkdirSync(dir, { recursive: true });
    }

    xlsx.writeFile(wb, outputPath);
    return outputPath;
}

module.exports = {
    processExcelAndEnrolUsers,
    generateErrorExcel,
};