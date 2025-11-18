
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
const axios = require('axios'); // Asegúrate de tener axios aquí si addService se define aquí

// URL de tu Moodle (puedes sacarla de config.js o directamente aquí si es fija)
const MOODLE_WEBSERVICE_URL = "https://moodle50.pascualbravovirtual.edu.co/webservice/rest/server.php";

// --- Función addService (si la defines aquí para matrículas) ---
async function addService(url, data) {
    try {
        const response = await axios.post(url, null, { params: data });
        return response.data;
    } catch (error) {
        console.error('Error en addService para matrículas:', error.response ? error.response.data : error.message);
        throw new Error(error.response ? (error.response.data.error || 'Error en el servicio externo') : 'Error de conexión');
    }
}
// -----------------------------------------------------------------

// Función para leer el archivo Excel
function readExcel(filePath) {
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0]; // Asume la primera hoja
    const worksheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(worksheet, { defval: '' }); // defval: '' asigna cadena vacía por defecto
    return data;
}

// *** IMPORTANTE: Mapear emails/códigos/nombres a IDs de Moodle ***
// Estas funciones son cruciales si tu Excel no tiene los IDs de Moodle directamente.
// Necesitarás implementarlas o usar el controller de users/courses/roles si ya existen.

// Ejemplo: Obtener ID de usuario por email
async function getUserIdByEmail(email, moodleToken, addServiceFunction) {
    const params = {
        'wstoken': moodleToken,
        'wsfunction': 'core_user_get_users_by_field',
        'moodlewsrestformat': 'json',
        'field': 'email',
        'values[0]': email
    };
    try {
        const result = await addServiceFunction(MOODLE_WEBSERVICE_URL, params);
        if (result && Array.isArray(result) && result.length > 0) {
            return result[0].id; // Retorna el ID del primer usuario encontrado
        }
        return null;
    } catch (error) {
        console.error(`Error al obtener ID de usuario para ${email}:`, error.message);
        return null;
    }
}

// Ejemplo: Obtener ID de curso por código (asumiendo que tu Excel tiene 'code')
async function getCourseIdByCode(code, moodleToken, addServiceFunction) {
    const params = {
        'wstoken': moodleToken,
        'wsfunction': 'core_course_get_courses', // Puede que necesites buscar por shortname o idnumber si tienes esos campos en Moodle
        'moodlewsrestformat': 'json',
        // Si tienes campos personalizados o sabes que el 'code' se mapea a 'shortname' o 'idnumber' en Moodle
        // 'options[ids][0]': code, // Esto sería si el code es el ID del curso
        // 'options[field]': 'shortname', 'options[value]': code // Esto sería si buscas por shortname
    };

    // Para buscar por un campo como 'shortname' o 'idnumber' en Moodle, a menudo necesitas iterar
    // Si tu Moodle tiene el servicio 'core_course_get_courses_by_field', sería más fácil.
    // Asumiré por ahora que 'code' en tu Excel se mapea a 'idnumber' en Moodle o 'shortname'.
    // Si el 'code' es el ID DIRECTO, no necesitas buscar.
    // Si necesitas buscar por 'code' y no es el ID directo, esta función será más compleja.
    // Para simplificar, buscaremos todos los cursos y filtramos si la API no permite buscar por un campo específico.
    try {
        const allCourses = await addServiceFunction(MOODLE_WEBSERVICE_URL, {
            'wstoken': moodleToken,
            'wsfunction': 'core_course_get_courses',
            'moodlewsrestformat': 'json'
        });
        const course = allCourses.find(c => String(c.idnumber) === String(code) || String(c.shortname) === String(code));
        return course ? course.id : null;
    } catch (error) {
        console.error(`Error al obtener ID de curso para ${code}:`, error.message);
        return null;
    }
}


// Ejemplo: Obtener ID de rol por nombre (ej. 'Estudiante', 'Profesor')
async function getRoleIdByName(roleName, moodleToken, addServiceFunction) {
    const params = {
        'wstoken': moodleToken,
        'wsfunction': 'core_role_get_roles_by_capability',
        'moodlewsrestformat': 'json',
        //'capabilities[0]': 'moodle/course:view'  Esto obtendrá todos los roles con capacidad de ver cursos
    };

    try {
        const response = await addServiceFunction(MOODLE_WEBSERVICE_URL, params);
        console.log("Respuesta completa de Moodle al obtener roles:", JSON.stringify(response, null, 2)); // Agrega esto

        const roles = response?.roles || [];

        if (!Array.isArray(roles)) {
            console.error("Respuesta inesperada al obtener roles:", response);
            return null;
        }

        const targetRoleName = roleName.trim().toLowerCase();
        console.log("Buscando el rol con nombre:", targetRoleName); // Agrega esto

        const foundRole = roles.find(r =>
            r.shortname.toLowerCase() === targetRoleName ||
            r.name.toLowerCase() === targetRoleName
        );

        if (foundRole) {
            console.log("Rol encontrado:", foundRole);
            return foundRole.id;
        } else {
            console.log("No se encontró el rol con el nombre o nombre corto:", targetRoleName, "en la lista de roles devuelta.");
            return null;
        }

    } catch (error) {
        console.error(`Error al obtener ID de rol para ${roleName}:`, error.message);
        return null;
    }
}

// Función para validar una matrícula
async function validateEnrollment(enrollmentData, moodleToken, addServiceFunction) {
    const errors = [];

    // Normalizar los campos importantes a string antes de la validación
    enrollmentData.code = (enrollmentData.code != null) ? String(enrollmentData.code).trim() : ''; // Código del curso
    enrollmentData.email = (enrollmentData.email != null) ? String(enrollmentData.email).trim() : ''; // Email del usuario
    enrollmentData.rol = (enrollmentData.rol != null) ? String(enrollmentData.rol).trim() : ''; // Nombre del rol
    enrollmentData.period = (enrollmentData.period != null) ? String(enrollmentData.period).trim() : ''; // Período (si lo usas)
    enrollmentData.state = (enrollmentData.state != null) ? String(enrollmentData.state).trim() : ''; // Estado (si lo usas)

    if (!enrollmentData.code) errors.push('El código del curso es obligatorio.');
    if (!enrollmentData.email) errors.push('El email del usuario es obligatorio.');
    if (!enrollmentData.rol) errors.push('El rol es obligatorio.');

    // --- Búsqueda de IDs de Moodle ---
    // Si tu Excel NO tiene userid, courseid, roleid directamente, necesitamos buscarlos.
    let userId = await getUserIdByEmail(enrollmentData.email, moodleToken, addServiceFunction);
    let courseId = await getCourseIdByCode(enrollmentData.code, moodleToken, addServiceFunction);
    let roleId = await getRoleIdByName(enrollmentData.rol, moodleToken, addServiceFunction);

    if (!userId) errors.push(`No se encontró el usuario con email: ${enrollmentData.email}.`);
    if (!courseId) errors.push(`No se encontró el curso con código: ${enrollmentData.code}.`);
    if (!roleId) errors.push(`No se encontró el rol con nombre: ${enrollmentData.rol}.`);

    // Asigna los IDs encontrados a los datos de matrícula
    enrollmentData.userid = userId;
    enrollmentData.courseid = courseId;
    enrollmentData.roleid = roleId;

    return errors;
}

// Función para matricular un usuario en Moodle
async function enrolUserInMoodle(enrollmentData, moodleToken, addServiceFunction) {
    const FUNCTION_NAME = 'enrol_manual_enrol_users';

    const params = {
        'wstoken': moodleToken,
        'wsfunction': FUNCTION_NAME,
        'moodlewsrestformat': 'json',
        'enrolments[0][userid]': enrollmentData.userid,
        'enrolments[0][courseid]': enrollmentData.courseid,
        'enrolments[0][roleid]': enrollmentData.roleid,
        // Opcionales (pueden venir del Excel)
        'enrolments[0][timestart]': enrollmentData.timestart || 0, // 0 = ahora
        'enrolments[0][timeend]': enrollmentData.timeend || 0,   // 0 = sin fecha de fin
        'enrolments[0][suspend]': enrollmentData.suspend || 0,   // 0 = activo
    };

    try {
        const response = await addServiceFunction(MOODLE_WEBSERVICE_URL, params);
        // La API de Moodle para enrol_manual_enrol_users devuelve un array vacío si tiene éxito, o un objeto de error.
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

// Función principal para procesar el Excel y matricular usuarios
async function processExcelAndEnrolUsers(filePath, moodleToken, addServiceFunction) {
    const excelData = readExcel(filePath);
    const errors = [];
    let successCount = 0;
    let errorCount = 0;

    for (const row of excelData) {
        // Pasa addServiceFunction para que las funciones de búsqueda puedan usarla
        const validationErrors = await validateEnrollment(row, moodleToken, addServiceFunction);
        if (validationErrors.length > 0) {
            errors.push({ ...row, errors: validationErrors.join(', ') });
            errorCount++;
        } else {
            const moodleResult = await enrolUserInMoodle(row, moodleToken, addServiceFunction);
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

// Función para generar el archivo Excel de errores
async function generateErrorExcel(errors) {
    if (errors.length === 0) {
        return null;
    }

    const ws = xlsx.utils.json_to_sheet(errors);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, 'Errores de Matrícula');

    const fileName = `errores_carga_matriculas_${Date.now()}.xlsx`;
    const outputPath = path.join(__dirname, '../../uploads', fileName);
    xlsx.writeFile(wb, outputPath);
    return outputPath;
}

module.exports = {
    processExcelAndEnrolUsers,
    generateErrorExcel,
};