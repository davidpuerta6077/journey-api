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

    async function markCourseAsSynchronized(id) {
        return data.updateCourseSyncStatus(id, true);
    }

    // ─── SICAU ────────────────────────────────────────────────────────────────

    async function saveSicauCurso(course) {
        const {
            codigo_asignatura,
            nombre_asignatura,
            programa,
            departamento,
            periodo,
            grupo,
            docente,
            fecha_inicio,
            fecha_fin
        } = course;

        // Construir campos derivados
        const periodoFormateado = periodo
            ? `${periodo.slice(0, 4)}-${periodo.slice(4)}`
            : '';

        const fullname  = `${grupo} ${nombre_asignatura} (${codigo_asignatura}) - Docente: ${docente} (${periodoFormateado})`;
        const shortname = `${grupo} ${nombre_asignatura} (${codigo_asignatura})(${periodoFormateado})`;
        const idnumber  = `${codigo_asignatura}${periodo}${grupo}`;
        const templatecourse = `SEMILLA-${codigo_asignatura}`;

        // Verificar si ya existe
        const existing = await data.findCourseByShortnameFn(shortname);
        if (existing.length > 0) {
            return { idnumber, status: 'exists' };
        }

        await data.insertCourse({
            fullname,
            shortname,
            idnumber,
            categoryid:        null,
            summary:           null,
            visible:           true,
            format:            'topics',
            numsections:       10,
            moodle_id:         null,
            seed_course_id:    null,
            departamento:      departamento      || null,
            programa:          programa          || null,
            docente:           docente           || null,
            fecha_inicio:      fecha_inicio      || null,
            fecha_fin:         fecha_fin         || null,
            periodo:           periodo           || null,
            grupo:             grupo             || null,
            codigo_asignatura: codigo_asignatura || null,
            nombre_asignatura: nombre_asignatura || null,
            templatecourse
        });

        return { idnumber, shortname, status: 'saved' };
    }

    return {
        list,
        addElement,
        updateElement,
        listCoursesForSync,
        updateCourseMoodleId,
        markCourseAsSynchronized,
        saveSicauCurso
    };
};