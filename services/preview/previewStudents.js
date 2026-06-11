const usersCtrl = require('../../api/users/index');
const { moodleRequest } = require('../moodleService');

const BATCH_SIZE = 50;

async function previewStudents() {
    const users = await usersCtrl.listUsersForSync();

    // Consultar Moodle en lotes en vez de una request por usuario
    const moodleUserMap = new Map();

    for (let i = 0; i < users.length; i += BATCH_SIZE) {
        const batch = users.slice(i, i + BATCH_SIZE);
        const params = { field: 'username' };
        batch.forEach((u, idx) => { params[`values[${idx}]`] = u.username; });

        try {
            const result = await moodleRequest('core_user_get_users_by_field', params);
            if (Array.isArray(result)) {
                result.forEach(mu => moodleUserMap.set(mu.username, mu));
            }
        } catch (e) {
            console.warn('Error consultando batch Moodle:', e.message);
        }
    }

    const results = [];

    for (const user of users) {
        const moodleUser = moodleUserMap.get(user.username) || null;
        const inMoodle   = !!moodleUser;

        try {
            if (moodleUser && !user.moodle_id) {
                await usersCtrl.updateMoodleId(user.id, moodleUser.id);
            } else if (!moodleUser && user.moodle_id) {
                await usersCtrl.clearMoodleId(user.id);
                await usersCtrl.markAsUnsynchronized(user.id);
            }
        } catch (e) {
            console.warn('Error actualizando moodle_id:', e.message);
        }

        results.push({
            ...user,
            _syncStatus: { inDB: true, inMoodle }
        });
    }

    return results;
}

module.exports = { previewStudents };
