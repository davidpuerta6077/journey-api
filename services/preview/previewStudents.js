const usersCtrl = require('../../api/users/index');
const { moodleRequest } = require('../moodleService');

async function previewStudents() {
    const users = await usersCtrl.listUsersForSync();
    const results = [];

    for (const user of users) {
        let inMoodle = false;
        let moodleUser = null;

        try {
            const result = await moodleRequest('core_user_get_users_by_field', {
                'field':     'username',
                'values[0]': user.username
            });
            moodleUser = Array.isArray(result) && result.length > 0 ? result[0] : null;
            inMoodle = !!moodleUser;

            if (moodleUser && !user.moodle_id) {
                await usersCtrl.updateMoodleId(user.id, moodleUser.id);
            } else if (!moodleUser && user.moodle_id) {
                await usersCtrl.clearMoodleId(user.id);
                await usersCtrl.markAsUnsynchronized(user.id);
            }
        } catch (e) {
            console.warn('Error consultando Moodle API:', e.message);
            inMoodle = user.sincronizado;
        }

        results.push({
            ...user,
            _syncStatus: { inDB: true, inMoodle }
        });
    }

    return results;
}

module.exports = { previewStudents };