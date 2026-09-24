const usersCtrl = require('../../api/users/index');
const { moodleRequest } = require('../moodleService');
const { normalizeUser } = require('../normalize');

// Mismo problema y misma solución que previewEnrollments.js: antes era una
// llamada a Moodle POR CADA usuario, una detrás de otra. Ahora es una sola
// llamada por lotes para todos los usernames (core_user_get_users_by_field
// acepta varios values[] en una sola petición).
async function previewStudents() {
    const users = await usersCtrl.listUsersForSync();

    const uniqueUsernames = [...new Set(users.map(u => u.username).filter(Boolean))];
    const moodleUsersByUsername = {};
    let lookupFailed = false;

    if (uniqueUsernames.length > 0) {
        const params = { field: 'username' };
        uniqueUsernames.forEach((u, i) => { params[`values[${i}]`] = u; });
        const result = await moodleRequest('core_user_get_users_by_field', params);
        if (Array.isArray(result)) {
            result.forEach(u => { moodleUsersByUsername[u.username] = u; });
        } else {
            lookupFailed = true;
        }
    }

    const results = [];
    for (const user of users) {
        const moodleUser = moodleUsersByUsername[user.username] || null;
        const inMoodle = lookupFailed ? user.sincronizado : !!moodleUser;

        // Reflejar en Nexo lo que ya se sabe de Moodle (mismo comportamiento
        // que antes, solo que ahora a partir del resultado por lotes en vez
        // de una consulta individual): sigue siendo una escritura por fila,
        // pero ya no espera a una llamada de red por cada una.
        if (!lookupFailed) {
            if (moodleUser && !user.moodle_id) {
                await usersCtrl.updateMoodleId(user.id, moodleUser.id);
            } else if (!moodleUser && user.moodle_id) {
                await usersCtrl.clearMoodleId(user.id);
                await usersCtrl.markAsUnsynchronized(user.id);
            }
        }

        results.push({
            ...user,
            ...normalizeUser(user),
            _syncStatus: { inDB: true, inMoodle }
        });
    }

    return results;
}

module.exports = { previewStudents };
