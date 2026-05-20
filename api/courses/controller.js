module.exports = (injectedDB) => {
    let data = injectedDB;
    if (!data) data = require('../../database/postgresql');

    function list(tabla) {
        return data.listAll(tabla);
    }

    async function addElement(courseData) {
        return data.insertCourse(courseData);
    }

    async function updateElement(courseData) {
        return data.updateCourse(courseData);
    }

    // ─── SYNC ─────────────────────────────────────────────────────────────────

    async function listCoursesForSync() {
        return data.getCoursesForSync();
    }

    async function updateCourseMoodleId(id, moodleId) {
        return data.setCourseMoodleId(id, moodleId);
    }

    // ─── SICAU ────────────────────────────────────────────────────────────────

    async function saveSicauCurso(course) {
        const existing = await data.findCourseByShortnameFn(course.shortname);

        if (existing.length > 0) {
            return { shortname: course.shortname, status: 'exists' };
        }

        await data.insertCourse({
            fullname:       course.fullname,
            shortname:      course.shortname,
            categoryid:     course.categoryid     || null,
            idnumber:       course.idnumber       || null,
            summary:        course.summary        || null,
            visible:        true,
            format:         'topics',
            numsections:    10,
            moodle_id:      null,
            seed_course_id: null
        });

        return { shortname: course.shortname, status: 'saved' };
    }

    return {
        list,
        addElement,
        updateElement,
        listCoursesForSync,
        updateCourseMoodleId,
        saveSicauCurso
    };
};