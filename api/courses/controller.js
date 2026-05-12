module.exports = (injectedDB) => {
    let data = injectedDB;
    if (!data) data = require('../../database/postgresql');

    function list(TABLA) {
        return data.listAll(TABLA);
    }

    async function addElement(TABLA, datas) {
        return data.insertItem(TABLA, datas);
    }

    async function updateElement(TABLA, datas) {
        return data.updateItem(TABLA, datas);
    }

    // ─── SICAU ───────────────────────────────────────────────────────────────
    async function saveSicauCurso(course) {
        const existing = await data.query({
            text: 'SELECT id FROM courses WHERE shortname = $1 LIMIT 1',
            values: [course.shortname]
        });

        if (existing.length > 0) {
            return { shortname: course.shortname, status: 'exists' };
        }

        await data.insertItem('courses', {
            fullname: course.fullname,
            shortname: course.shortname,
            categoryid: course.categoryid || null,
            idnumber: course.idnumber || null,
            summary: course.summary || null,
            visible: true,
            format: 'topics',
            numsections: 10,
            moodle_id: null,
            seed_course_id: null
        });

        return { shortname: course.shortname, status: 'saved' };
    }

    return {
        list,
        addElement,
        updateElement,
        saveSicauCurso
    };
};