const coursesCtrl = require('../../api/courses/index');
const { normalizeCourse } = require('../normalize');
const config = require('../../config');

const MOODLE_SITE_URL = new URL(config.moodle.url).origin;

async function previewCourses() {
    const courses = await coursesCtrl.listCoursesForSync();
    return courses.map(course => ({
        ...course,
        ...normalizeCourse(course),
        moodle_course_url: course.moodle_id ? `${MOODLE_SITE_URL}/course/view.php?id=${course.moodle_id}` : null,
        _syncStatus: { inDB: true, inMoodle: !!course.moodle_id }
    }));
}

module.exports = { previewCourses };