const coursesCtrl = require('../../api/courses/index');

async function previewCourses() {
    const courses = await coursesCtrl.listCoursesForSync();
    return courses.map(course => ({
        ...course,
        _syncStatus: { inDB: true, inMoodle: !!course.moodle_id }
    }));
}

module.exports = { previewCourses };