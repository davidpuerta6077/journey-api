const enrollmentsCtrl = require('../../api/enrollments/index');
const usersCtrl = require('../../api/users/index');
const { moodleRequest } = require('../moodleService');

async function previewEnrollments() {
    const enrollments = await enrollmentsCtrl.listEnrollmentsForSync();
    const results = [];

    for (const enr of enrollments) {
        let inMoodle = false;
        let userExistsInMoodle = false;

        try {
            const result = await moodleRequest('core_user_get_users_by_field', {
                'field':     'username',
                'values[0]': enr.username
            });
            const moodleUser = Array.isArray(result) && result.length > 0 ? result[0] : null;
            userExistsInMoodle = !!moodleUser;

            if (userExistsInMoodle && enr.sincronizado && enr.user_moodle_id) {
                const courses = await moodleRequest('core_enrol_get_users_courses', {
                    'userid': enr.user_moodle_id
                });
                if (Array.isArray(courses)) {
                    inMoodle = courses.some(c => c.idnumber === enr.codigo_journey);
                }
            }
        } catch (e) {
            console.warn('Error consultando Moodle API para matrícula:', e.message);
            inMoodle = !!enr.moodle_enrollment_id;
            userExistsInMoodle = !!enr.user_moodle_id;
        }

        results.push({
            ...enr,
            studentId:          enr.userid,
            courseId:           enr.courseid,
            userExistsInMoodle,
            _syncStatus:        { inDB: true, inMoodle }
        });
    }

    return results;
}

module.exports = { previewEnrollments };