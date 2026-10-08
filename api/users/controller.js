const path = require('path');
const xlsx = require('xlsx');
const fs = require('fs');
const config = require('../../config');
const { getDominioCorreoPermitido, emailTieneDominio } = require('../../services/emailDomain');

const MOODLE_SITE_URL = new URL(config.moodle.url).origin;

module.exports = (injectedDB) => {
    let data = injectedDB;
    if (!data) data = require('../../database/postgresql');

    function list(tabla) {
        return data.listAll(tabla);
    }

    async function addElement(userData) {
        return data.insertUser(userData);
    }

    async function updateElement(userData) {
        return data.updateUser(userData);
    }

    async function updateJourneyUser(userData) {
        return data.updateJourneyUser(userData);
    }

    async function deleteUser(id) {
        return data.deleteUser(id);
    }

    // ─── SYNC ─────────────────────────────────────────────────────────────────

    async function listUsersForSync() {
        return data.getUsersForSync();
    }

    async function updateMoodleId(id, moodleId) {
        return data.setUserMoodleId(id, moodleId);
    }

    async function clearMoodleId(id) {
        return data.removeUserMoodleId(id);
    }

    async function markAsSynchronized(id) {
        return data.updateUserSyncStatus(id, true);
    }

    // ✅ nuevo: marca usuario como no sincronizado y limpia moodle_id
    async function markAsUnsynchronized(id) {
        return data.updateUserUnsync(id);
    }

    // Persiste los campos normalizados (nombre, apellido, correos) de un usuario.
    async function applyNormalization(id, fields) {
        return data.updateUserNormalized(id, fields);
    }

    // ─── EXCEL PROCESSOR ──────────────────────────────────────────────────────

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

    function validateUser(userData, dominioCorreo) {
        const errors = [];
        userData.name      = (userData.name      != null) ? String(userData.name).trim()      : '';
        userData.last_name = (userData.last_name != null) ? String(userData.last_name).trim() : '';
        userData.document  = (userData.document  != null) ? String(userData.document).trim()  : '';
        userData.email     = (userData.email     != null) ? String(userData.email).trim()     : '';

        if (!userData.name)      errors.push('El nombre es obligatorio.');
        if (!userData.last_name) errors.push('El apellido es obligatorio.');
        if (!userData.document)  errors.push('El documento es obligatorio.');
        if (!userData.email || !/\S+@\S+\.\S+/.test(userData.email)) errors.push('El email es inválido.');
        else if (!emailTieneDominio(userData.email, dominioCorreo)) errors.push(`El email debe ser del dominio institucional (@${dominioCorreo}).`);

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
        const dominioCorreo = await getDominioCorreoPermitido(data);
        const errors = [];
        let successCount = 0;
        let errorCount = 0;

        for (const row of excelData) {
            const validationErrors = validateUser(row, dominioCorreo);
            if (validationErrors.length > 0) {
                errors.push({ ...row, errors: validationErrors.join(', ') });
                errorCount++;
                continue;
            }
            try {
                const username = row.username.toLowerCase();
                const existing = await data.findUserSicau(row.email, username);
                if (existing.length > 0) {
                    errors.push({ ...row, errors: 'Ya existe un usuario con ese email o username' });
                    errorCount++;
                    continue;
                }
                await data.insertUser({
                    username,
                    firstname:    row.name,
                    lastname:     row.last_name,
                    email:        row.email,
                    password:     row.password,
                    city:         row.city    || 'Desconocido',
                    country:      row.country || 'CO',
                    documento:    row.document,
                    moodle_id:    null,
                    sincronizado: false
                });
                successCount++;
            } catch (dbError) {
                errors.push({ ...row, errors: `Error DB: ${dbError.message}` });
                errorCount++;
            }
        }
        return { successCount, errorCount, errors };
    }
    async function saveJourneyUsuario(user) {
        const dominioCorreo = await getDominioCorreoPermitido(data);
        if (!emailTieneDominio(user.email, dominioCorreo)) {
            const err = new Error(`El email debe ser del dominio institucional (@${dominioCorreo})`);
            err.status = 400;
            throw err;
        }
        const existing = await data.findUserSicau(user.email, user.username || user.email);
        if (existing.length > 0) {
            throw new Error('Ya existe un usuario con ese email o username');
        }
        const result = await data.insertUser({
            username:               user.username || user.email,
            firstname:              user.firstname,
            lastname:               user.lastname,
            email:                  user.email,
            password:               user.documento ? String(user.documento) : 'Pascual2024*',
            city:                   user.city                   || 'Medellín',
            country:                user.country                || 'CO',
            documento:              user.documento              || null,
            correo_personal:        user.correo_personal        || null,
            telefono:               user.telefono               || null,
            celular:                user.celular                || null,
            fecha_nacimiento:       user.fecha_nacimiento       || null,
            jornada:                user.jornada                || null,
            departamento_academico: user.departamento_academico || null,
            plan_estudios:          user.plan_estudios          || null,
            moodle_id:              null,
            sincronizado:           false
        });
        return result[0];
    }

async function resetUserPassword(id) {
    const users = await data.getUsersForSync();
    const user = users.find(u => u.id === parseInt(id));
    if (!user) throw new Error('Usuario no encontrado');
    const newPassword = user.documento || 'Pascual2024*';
    await data.resetPassword(id, newPassword);
    return { status: 'reset', message: `Contraseña restablecida al documento` };
}

// ─── NOVEDAD DE USUARIOS (SICAU reportó un cambio de correo) ──────────────
// El correo es el username en Moodle: cuando SICAU manda uno distinto para un
// usuario ya existente, api/SICAU/controller.js no lo pisa solo, lo deja en
// correo_pendiente (ver saveSicauUsuario). Estas tres acciones son la decisión
// humana desde Sync > Usuarios: actualizar el usuario existente, crear uno
// nuevo con el correo nuevo (el viejo queda intacto para historial), o
// descartar la propuesta si fue un falso positivo de SICAU.

async function findUserForSyncById(id) {
    const users = await data.getUsersForSync();
    return users.find(u => u.id === parseInt(id));
}

async function aplicarCorreoPendiente(id) {
    const user = await findUserForSyncById(id);
    if (!user) throw new Error('Usuario no encontrado');
    if (!user.correo_pendiente) throw new Error('Este usuario no tiene un cambio de correo pendiente');
    const result = await data.applyCorreoPendiente(id);
    return result[0];
}

async function duplicarPorCorreoPendiente(id) {
    const user = await findUserForSyncById(id);
    if (!user) throw new Error('Usuario no encontrado');
    if (!user.correo_pendiente) throw new Error('Este usuario no tiene un cambio de correo pendiente');
    // documento tiene índice único (un usuario = una persona): el original se
    // archiva primero (documento + "0") para liberar el documento real antes
    // de insertar el usuario nuevo con ese mismo documento.
    await data.archiveUserDocumento(id);
    const nuevo = await data.insertUser({
        username:               user.correo_pendiente,
        firstname:               user.firstname,
        lastname:                user.lastname,
        email:                   user.correo_pendiente,
        password:                user.documento ? String(user.documento) : 'Pascual2024*',
        city:                    user.city,
        country:                 user.country,
        documento:               user.documento,
        correo_personal:         user.correo_personal,
        telefono:                user.telefono,
        celular:                 user.celular,
        fecha_nacimiento:        user.fecha_nacimiento,
        jornada:                 user.jornada,
        departamento_academico:  user.departamento_academico,
        plan_estudios:           user.plan_estudios,
        moodle_id:               null,
        sincronizado:            false
    });
    return nuevo[0];
}

async function descartarCorreoPendiente(id) {
    const user = await findUserForSyncById(id);
    if (!user) throw new Error('Usuario no encontrado');
    if (!user.correo_pendiente) throw new Error('Este usuario no tiene un cambio de correo pendiente');
    await data.clearUserCorreoPendiente(id);
    return { status: 'descartado' };
}

async function getUserEnrollments(userId) {
    const enrollments = await data.getEnrollmentsByUserId(userId);
    return enrollments.map(e => ({
        ...e,
        moodle_course_url: e.course_moodle_id ? `${MOODLE_SITE_URL}/course/view.php?id=${e.course_moodle_id}` : null,
    }));
}

/* Adding User to Auth */
async function addUserElement(json) {
    return data.insertUserDatas(json)
}

async function addConsentData(json) {
    return data.insertConsentDatas(json)
}

async function itemByEmailData(TABLE, EMAIL) {
    return data.itemByEmail(TABLE, EMAIL)
}


    return {
        list,
        addElement,
        updateElement,
        updateJourneyUser,
        deleteUser,
        listUsersForSync,
        saveJourneyUsuario,
        resetUserPassword,
        aplicarCorreoPendiente,
        duplicarPorCorreoPendiente,
        descartarCorreoPendiente,
        getUserEnrollments,
        updateMoodleId,
        clearMoodleId,
        generateErrorExcel,
        processExcelAndCreateUsers,
        markAsSynchronized,
        markAsUnsynchronized,
        applyNormalization
    };
};