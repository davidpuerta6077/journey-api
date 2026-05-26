const enrollmentsCtrl = require('../../api/enrollments/index');

async function previewEnrollments() {
    const enrollments = await enrollmentsCtrl.listEnrollmentsForSync();
    return enrollments.map(enr => ({
        ...enr,
        studentId:   enr.userid,
        courseId:    enr.courseid,
        _syncStatus: { inDB: true, inMoodle: !!enr.moodle_enrollment_id }
    }));
}

module.exports = { previewEnrollments };