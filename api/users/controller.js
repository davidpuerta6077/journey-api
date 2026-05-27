const path = require('path');
const xlsx = require('xlsx');
const fs = require('fs');
const { moodleRequest } = require('../../services/moodleService');

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

    // ─── SICAU ────────────────────────────────────────────────────────────────

    async function saveSicauUsuario(user) {
        const existing = await data.findUserSicau(user.email, user.username);

        if (existing.length > 0) {
            await data.updateUserFromSicau(user);
            return { username: user.username, status: 'updated' };
        } else {
            await data.insertUser({
                username:               user.username,
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
            return { username: user.username, status: 'saved' };
        }
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

    function validateUser(userData) {
        const errors = [];
        userData.name      = (userData.name      != null) ? String(userData.name).trim()      : '';
        userData.last_name = (userData.last_name != null) ? String(userData.last_name).trim() : '';
        userData.document  = (userData.document  != null) ? String(userData.document).trim()  : '';
        userData.email     = (userData.email     != null) ? String(userData.email).trim()     : '';

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

    return {
        list,
        addElement,
        updateElement,
        updateJourneyUser,
        deleteUser,
        listUsersForSync,
        updateMoodleId,
        clearMoodleId,
        saveSicauUsuario,
        generateErrorExcel,
        processExcelAndCreateUsers,
        markAsSynchronized,
        markAsUnsynchronized
    };
};