const coursesCtrl = require('../../api/courses/index');
const { normalizeCourse } = require('../normalize');

async function previewCourses() {
    const courses = await coursesCtrl.listCoursesForSync();
    return courses.map(course => ({
        ...course,
        ...normalizeCourse(course),
        _syncStatus: { inDB: true, inMoodle: !!course.moodle_id }
    }));
}

module.exports = { previewCourses };