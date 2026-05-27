const enrollmentsCtrl = require('../../api/enrollments/index');
const { moodleRequest } = require('../moodleService');

async function previewEnrollments() {
    const enrollments = await enrollmentsCtrl.listEnrollmentsForSync();

    return Promise.all(enrollments.map(async (enr) => {
        let inMoodle = false;

        try {
            if (enr.sincronizado && enr.user_moodle_id) {
                const result = await moodleRequest('core_enrol_get_users_courses', {
                    'userid': enr.user_moodle_id
                });

                if (Array.isArray(result)) {
                    inMoodle = result.some(c => c.idnumber === enr.codigo_journey);
                }
            }
        } catch (e) {
            console.warn('Error consultando Moodle API para matrícula:', e.message);
            inMoodle = !!enr.moodle_enrollment_id;
        }

        return {
            ...enr,
            studentId:   enr.userid,
            courseId:    enr.courseid,
            _syncStatus: { inDB: true, inMoodle }
        };
    }));
}

module.exports = { previewEnrollments };