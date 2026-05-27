const { moodleRequest } = require('../moodleService');
const enrollmentsCtrl = require('../../api/enrollments/index');

const parseMoodleEnrollmentId = (result) => {
    if (!result) return null;
    if (Array.isArray(result) && result.length > 0) {
        return result[0]?.id || result[0]?.enrollmentid || null;
    }
    return result.id || result.enrollmentid || null;
};

async function syncEnrollments(items = []) {
    const results = [];
    const allEnrollments = await enrollmentsCtrl.listEnrollmentsForSync();

    for (const enr of items) {
        const userid   = enr.studentId || enr.teacherId || enr.userid;
        const courseid = enr.courseId  || enr.courseid;
        const result   = { id: enr.id, userid, courseid };

        try {
            if (!userid || !courseid) {
                result.status = 'error';
                result.error = 'Sin userid o courseId';
                results.push(result);
                continue;
            }

            const existing = allEnrollments.find(e => e.userid === userid && e.courseid === courseid);
            let localEnrollment = null;

            if (existing) {
                localEnrollment = existing;
                result.status = 'exists';
            } else {
                const inserted = await enrollmentsCtrl.addElement({
                    userid,
                    courseid,
                    role: enr.role || 'student',
                    moodle_enrollment_id: null
                });
                localEnrollment = inserted[0];
                result.status = 'success';
            }

            if (!localEnrollment.moodle_enrollment_id) {
                const moodleResult = await moodleRequest('enrol_manual_enrol_users', {
                    'enrolments[0][userid]': userid,
                    'enrolments[0][courseid]': courseid,
                    'enrolments[0][roleid]': enr.role === 'teacher' ? 3 : 5
                });

                const moodleEnrollmentId = parseMoodleEnrollmentId(moodleResult);
                if (moodleEnrollmentId) {
                    await enrollmentsCtrl.updateEnrollmentMoodleId(localEnrollment.id, moodleEnrollmentId);
                    result.moodle_enrollment_id = moodleEnrollmentId;
                } else {
                    result.moodle_warning = 'Matrícula guardada en BD pero no en Moodle';
                }
            }

        } catch (error) {
            console.error('Error sincronizando matrícula:', userid, courseid, error.message);
            result.status = 'error';
            result.error = error.message;
        }

        results.push(result);
    }

    return { results };
}

module.exports = { syncEnrollments };