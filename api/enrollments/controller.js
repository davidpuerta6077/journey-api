
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
        console.error('Error en addService:', error.response ? error.response.data : error.message);
        throw new Error(error.response ? (error.response.data.error || 'Error externo') : 'Error de conexión');
    }
}

// Función para leer Excel
function readExcel(filePath) {
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    return xlsx.utils.sheet_to_json(worksheet, { defval: '' });
}

// --- BUSCADORES ---

async function getUserIdByEmail(email, moodleToken) {
    const params = {
        'wstoken': moodleToken,
        'wsfunction': 'core_user_get_users_by_field',
        'moodlewsrestformat': 'json',
        'field': 'email',
        'values[0]': email
    };
    try {
        const result = await addService(MOODLE_WEBSERVICE_URL, params);
        if (result && Array.isArray(result) && result.length > 0) {
            return result[0].id;
        }
        return null;
    } catch (error) {
        console.error(`Error buscando usuario ${email}:`, error.message);
        return null;
    }
}

async function getCourseIdByCode(code, moodleToken) {
    // Nota: Para optimizar, en producción deberías cachear la lista de cursos si son muchos.
    const params = {
        'wstoken': moodleToken,
        'wsfunction': 'core_course_get_courses',
        'moodlewsrestformat': 'json',
    };
    try {
        const allCourses = await addService(MOODLE_WEBSERVICE_URL, params);
        // Busca coincidencia en idnumber (recomendado) o shortname
        const course = allCourses.find(c => String(c.idnumber) === String(code) || String(c.shortname) === String(code));
        return course ? course.id : null;
    } catch (error) {
        console.error(`Error buscando curso ${code}:`, error.message);
        return null;
    }
}

async function getRoleIdByName(roleName, moodleToken) {
    const inputName = roleName ? String(roleName).trim().toLowerCase() : 'student';
    
    // Mapa estático para evitar llamadas innecesarias a la API
    const staticRoleMap = {
        'manager': 1, 'gestor': 1,
        'coursecreator': 2, 'creador': 2,
        'editingteacher': 3, 'profesor': 3, 'docente': 3,
        'teacher': 4, 'profesor sin permisos': 4,
        'student': 5, 'estudiante': 5, 'alumno': 5, 'aprendiz': 5,
        'guest': 6, 'invitado': 6
    };

    if (staticRoleMap[inputName]) return staticRoleMap[inputName];

    // Fallback a API si es un rol raro
    try {
        const params = {
            'wstoken': moodleToken,
            'wsfunction': 'core_role_get_assignable_roles',
            'moodlewsrestformat': 'json',
            'contextid': 1
        };
        const roles = await addService(MOODLE_WEBSERVICE_URL, params);
        if (Array.isArray(roles)) {
            const found = roles.find(r => r.shortname.toLowerCase() === inputName || r.name.toLowerCase() === inputName);
            return found ? found.id : 5; // Retorna 5 (estudiante) por defecto si no encuentra nada
        }
        return 5;
    } catch (e) {
        return 5; // Default seguro
    }
}

// --- NUEVA FUNCIÓN: CREAR USUARIO ---
async function createUserInMoodle(userData, moodleToken) {
    const params = {
        'wstoken': moodleToken,
        'wsfunction': 'core_user_create_users',
        'moodlewsrestformat': 'json',
        
        // Datos obligatorios
        'users[0][username]': userData.email.toLowerCase(), // Usamos email como username
        'users[0][password]': 'Pascual2025*', // Contraseña por defecto (cámbiala si quieres)
        'users[0][firstname]': userData.name || 'Sin Nombre',
        'users[0][lastname]': userData.last_name || 'Sin Apellido',
        'users[0][email]': userData.email,
        'users[0][auth]': 'manual',
        
        // Datos opcionales (mapeados desde tu Excel extendido)
        'users[0][idnumber]': userData.document || '', // Cédula/Documento
        'users[0][phone1]': userData.phone || userData.cellPhone || '',
        'users[0][city]': userData.departamento || 'Medellín',
        'users[0][country]': 'CO'
    };

    try {
        console.log(`Intentando crear usuario: ${userData.email}`);
        const response = await addService(MOODLE_WEBSERVICE_URL, params);
        
        // Si hay error (ej: username ya existe, aunque ya lo verificamos antes)
        if (response.exception) {
            throw new Error(response.message);
        }

        // Moodle devuelve un array con los usuarios creados [{id: 123, username: "..."}]
        if (Array.isArray(response) && response.length > 0) {
            return response[0].id;
        } else {
            throw new Error("Moodle no devolvió el ID del usuario creado.");
        }
    } catch (error) {
        throw new Error(`Error creando usuario: ${error.message}`);
    }
}

// --- FUNCIONES PRINCIPALES ---

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
        const response = await addService(MOODLE_WEBSERVICE_URL, params);
        if (response && response.exception) {
            return { success: false, error: response.message };
        }
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

async function processExcelAndEnrolUsers(filePath, moodleToken) {
    const excelData = readExcel(filePath);
    const errors = [];
    let successCount = 0;
    let errorCount = 0;

    for (const row of excelData) {
        const rowErrors = [];
        
        // 1. Validar datos mínimos obligatorios
        if (!row.email) rowErrors.push('Falta email');
        if (!row.code) rowErrors.push('Falta código curso');
        
        // Limpieza básica
        const email = String(row.email || '').trim();
        const code = String(row.code || '').trim();
        const roleName = String(row.rol || 'estudiante').trim();

        if (rowErrors.length > 0) {
            errors.push({ ...row, errors: rowErrors.join(', ') });
            errorCount++;
            continue;
        }

        try {
            // 2. Obtener IDs (Curso y Rol)
            const courseId = await getCourseIdByCode(code, moodleToken);
            const roleId = await getRoleIdByName(roleName, moodleToken);

            if (!courseId) {
                errors.push({ ...row, errors: `Curso no encontrado: ${code}` });
                errorCount++;
                continue;
            }

            // 3. Gestionar Usuario (Buscar o Crear)
            let userId = await getUserIdByEmail(email, moodleToken);

            if (!userId) {
                // El usuario NO existe. Verificamos si podemos crearlo.
                // ¿Tenemos datos mínimos para crear? (Nombre y Apellido)
                if (row.name && row.last_name) {
                    try {
                        userId = await createUserInMoodle(row, moodleToken);
                        console.log(`Usuario creado exitosamente: ${email} (ID: ${userId})`);
                    } catch (createError) {
                        errors.push({ ...row, errors: `No existe y falló al crear: ${createError.message}` });
                        errorCount++;
                        continue; 
                    }
                } else {
                    // No existe y faltan datos en el Excel para crearlo
                    errors.push({ ...row, errors: 'Usuario no existe y faltan datos (name, last_name) para crearlo.' });
                    errorCount++;
                    continue;
                }
            }

            // 4. Matricular
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

async function suspendUserInMoodle(userId, courseId, moodleToken) {
    const params = {
        'wstoken': moodleToken,
        'wsfunction': 'enrol_manual_enrol_users',
        'moodlewsrestformat': 'json',
        'enrolments[0][userid]': userId,
        'enrolments[0][courseid]': courseId,
        'enrolments[0][roleid]': 5, // Asumimos rol de estudiante (ID 5) para suspender
        'enrolments[0][suspend]': 1 // <--- 1 significa SUSPENDIDO (Activo es 0)
    };

    try {
        const response = await addService(MOODLE_WEBSERVICE_URL, params);
        if (response && response.exception) {
            return { success: false, error: response.message };
        }
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// Función principal que procesa el Excel de novedades
async function processExcelAndSuspendUsers(filePath, moodleToken) {
    const excelData = readExcel(filePath);
    const errors = [];
    let successCount = 0;
    let errorCount = 0;

    for (const row of excelData) {
        // Aceptamos columnas 'usuario'/'email' y 'curso'/'code'
        const email = String(row.usuario || row.email || '').trim();
        const code = String(row.curso || row.code || '').trim();

        if (!email || !code) {
            errors.push({ ...row, errors: 'Faltan datos (usuario o curso)' });
            errorCount++;
            continue;
        }

        try {
            // Reutilizamos las funciones de búsqueda que ya tenías
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

            // Llamamos a la función de suspender
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

async function generateErrorExcel(errors) {
    if (errors.length === 0) return null;

    const ws = xlsx.utils.json_to_sheet(errors);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, 'Errores');

    const fileName = `errores_matriculas_${Date.now()}.xlsx`;
    const outputPath = path.join(__dirname, '../../uploads', fileName);
    
    // Asegurar que la carpeta existe
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    xlsx.writeFile(wb, outputPath);
    return outputPath; // Devuelve la ruta absoluta (o relativa según tu configuración de rutas en Express)
}

module.exports = {
    processExcelAndEnrolUsers,
    processExcelAndSuspendUsers,
    generateErrorExcel
};