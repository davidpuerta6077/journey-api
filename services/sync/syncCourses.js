const { moodleRequest } = require('../moodleService');
const coursesCtrl = require('../../api/courses/index');

const parseMoodleId = (result) => {
    if (!result) return null;
    if (Array.isArray(result) && result.length > 0) {
        return result[0]?.id || result[0]?.userid || null;
    }
    return result.id || result.userid || null;
};

async function syncCourses(items = []) {
    const results = [];
    const localCourses = await coursesCtrl.listCoursesForSync();

    for (const course of items) {
        const result = { id: course.id, shortname: course.shortname };

        try {
            if (!course.shortname) {
                result.status = 'error';
                result.error = 'Sin shortname';
                results.push(result);
                continue;
            }

            const saved = await coursesCtrl.saveSicauCurso(course);
            result.status = saved.status;

            const localCourse = localCourses.find(c => c.shortname === course.shortname);

            if (localCourse && !localCourse.moodle_id) {
                const moodleResult = await moodleRequest('core_course_create_courses', {
                    'courses[0][fullname]': course.fullname,
                    'courses[0][shortname]': course.shortname,
                    'courses[0][categoryid]': course.categoryid || 1,
                    'courses[0][idnumber]': course.idnumber || course.shortname,
                    'courses[0][summary]': course.summary || '',
                    'courses[0][format]': course.format || 'topics',
                    'courses[0][numsections]': course.numsections || 10
                });

                const moodleId = parseMoodleId(moodleResult);
                if (moodleId) {
                    await coursesCtrl.updateCourseMoodleId(localCourse.id, moodleId);
                    result.moodle_id = moodleId;
                } else {
                    result.moodle_warning = 'Curso guardado en BD pero no en Moodle';
                }
            }

        } catch (error) {
            console.error('Error sincronizando curso:', course.shortname, error.message);
            result.status = 'error';
            result.error = error.message;
        }

        results.push(result);
    }

    return { results };
}

module.exports = { syncCourses };