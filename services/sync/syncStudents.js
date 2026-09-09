const usersCtrl = require('../../api/users/index');
const { moodleRequest } = require('../moodleService');
const { assertMoodleOk } = require('../moodleAssert');
const { logSyncError } = require('../syncLog');
const { normalizeUser, difiere } = require('../normalize');

const CAMPOS_NORM = ['firstname', 'lastname', 'email', 'correo_personal'];

async function syncStudents(items = [], username = 'system') {
    const results = [];

    for (const user of items) {
        const result = { id: user.id, username: user.username, email: user.email };

        try {
            if (!user.id) {
                result.status = 'error';
                result.error = 'Sin ID de usuario';
                results.push(result);
                continue;
            }

            // Normalizar antes de sincronizar: si cambió algo, se persiste en la
            // BD de Journey para que el cron de Moodle lea el dato ya limpio.
            let norm = null;
            if (user.firstname !== undefined || user.lastname !== undefined) {
                const candidato = normalizeUser(user);
                if (difiere(user, candidato, CAMPOS_NORM)) {
                    await usersCtrl.applyNormalization(user.id, candidato);
                    result.normalized = true;
                    norm = candidato;
                }
            }

            // Si el usuario ya existe en Moodle y su nombre/correo se normalizó,
            // se refleja allá también (el cron no reescribe usuarios existentes).
            // Best-effort: un fallo aquí no impide marcar el registro.
            if (norm && user.moodle_id) {
                try {
                    const updateResp = await moodleRequest('core_user_update_users', {
                        'users[0][id]':        user.moodle_id,
                        'users[0][firstname]': norm.firstname,
                        'users[0][lastname]':  norm.lastname,
                        'users[0][email]':     norm.email
                    });
                    assertMoodleOk(updateResp, 'Error actualizando el nombre normalizado en Moodle');
                    result.moodleUpdated = true;
                } catch (moodleErr) {
                    result.moodleUpdateError = moodleErr.message;
                    await logSyncError('user', user.id, moodleErr.message, username);
                }
            }

            await usersCtrl.markAsSynchronized(user.id);
            result.status = 'success';
            result.message = 'Marcado como sincronizado. El cron de Moodle procesará este registro.';

        } catch (error) {
            console.error('Error sincronizando usuario:', user.username, error.message);
            result.status = 'error';
            result.error = error.message;
        }

        results.push(result);
    }

    return { results };
}

module.exports = { syncStudents };
