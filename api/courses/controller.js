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

    async function markCourseSyncFailed(id, errorMessage) {
        return data.markCourseSyncError(id, errorMessage);
    }

    async function markCourseSyncing(id) {
        return data.markCourseSyncing(id);
    }

    async function setCourseSyncFields(id, fields) {
        return data.setCourseSyncFields(id, fields);
    }

    async function resolveSyncRule(codigoAsignatura, programa, departamento) {
        const rows = await data.findSyncRule(codigoAsignatura, programa, departamento);
        return rows[0] || null;
    }

    // Regla elegida a mano por el usuario en Sync Cursos, en vez de la resuelta
    // automáticamente por codigo_asignatura/programa/departamento.
    async function getSyncRuleById(id) {
        const rows = await data.findSyncRuleById(id);
        return rows[0] || null;
    }

    async function findByIdnumber(idnumber) {
        const rows = await data.findCourseSicau(idnumber);
        return rows[0] || null;
    }

    // Persiste los campos normalizados (fullname, shortname, nombre_asignatura,
    // nombre_profesor, departamento, programa).
    async function applyNormalization(id, fields) {
        return data.updateCourseNormalized(id, fields);
    }

    // "Cierre de semestre" de un curso puntual: pasa a Finalizado sus
    // matrículas activas. Moodle las desmatricula sola en el próximo cron
    // (ver fixMoodleExternalDbViews.js), acá no se llama a Moodle.
    async function finalizeEnrollments(courseid) {
        const rows = await data.reportCourseById(courseid);
        const course = rows[0] || null;
        if (!course) throw new Error('Curso no encontrado');
        const finalizadas = await data.finalizeCourseEnrollments(courseid);
        return { course, finalizadas: finalizadas.length };
    }

    return {
        list,
        addElement,
        updateElement,
        listCoursesForSync,
        updateCourseMoodleId,
        markCourseAsSynchronized,
        markCourseSyncFailed,
        markCourseSyncing,
        setCourseSyncFields,
        resolveSyncRule,
        getSyncRuleById,
        findByIdnumber,
        applyNormalization,
        finalizeEnrollments
    };
};