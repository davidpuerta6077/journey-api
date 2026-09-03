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

    return {
        list,
        addElement,
        updateElement,
        listCoursesForSync,
        updateCourseMoodleId,
        markCourseAsSynchronized
    };
};