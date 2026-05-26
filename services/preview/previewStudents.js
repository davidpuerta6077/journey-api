const usersCtrl = require('../../api/users/index');
const { getMoodleUserByUsername } = require('../moodle/getMoodleUser');

async function previewStudents() {
    const users = await usersCtrl.listUsersForSync();

    return Promise.all(users.map(async (user) => {
        const moodleUser = await getMoodleUserByUsername(user.username);
        const inMoodle = !!moodleUser;

        if (moodleUser && !user.moodle_id) {
            await usersCtrl.updateMoodleId(user.id, moodleUser.id);
        } else if (!moodleUser && user.moodle_id) {
            await usersCtrl.clearMoodleId(user.id);
        }

        return {
            ...user,
            _syncStatus: { inDB: true, inMoodle }
        };
    }));
}

module.exports = { previewStudents };