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

    // Persiste los campos normalizados (fullname, shortname, nombre_asignatura).
    async function applyNormalization(id, fields) {
        return data.updateCourseNormalized(id, fields);
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
        applyNormalization
    };
};