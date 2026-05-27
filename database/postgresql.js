const config = require('../config');
const { Pool } = require('pg');
const {
    selectAllItems,
    selectAllUsers, selectUsersForSync, insertUsuarioData, updateUsuarioData,
    updateUsuarioJourney, deleteUsuarioData,
    updateUserMoodleId, clearUserMoodleId, findUserByEmailOrUsername,
    findUserByDocumento, updateUserSicau,
    updateUserSyncStatusQuery,          // ✅ CORREGIDO: import que Gemini eliminó
    selectAllCourses, selectCoursesForSync, insertCourseData, updateCourseData,
    updateCourseMoodleId, findCourseByIdnumber, findCourseByShortname,
    selectAllEnrollments, selectEnrollmentsForSync, insertEnrollmentData,
    updateEnrollmentData, updateEnrollmentMoodleId, findEnrollmentByCodigoJourney,
    findAllEnrollmentsWithUsers,
    healthCheck
} = require('./querysets');

const pool = new Pool({
    database: config.postgresql.database,
    user:     config.postgresql.user,
    password: config.postgresql.password,
    host:     config.postgresql.host,
    port:     config.postgresql.port,
});

// ─── GENÉRICO ─────────────────────────────────────────────────────────────────

function listAll(table) {
    return new Promise((resolve, reject) => {
        pool.query(selectAllItems(table), (err, data) => {
            if (err) return reject(err);
            resolve(data.rows);
        });
    });
}

function query(queryConfig) {
    return new Promise((resolve, reject) => {
        pool.query(queryConfig, (err, data) => {
            if (err) return reject(err);
            resolve(data.rows);
        });
    });
}

// ─── USERS ────────────────────────────────────────────────────────────────────

function insertUser(data) {
    return new Promise((resolve, reject) => {
        pool.query(insertUsuarioData(data), (err, result) => {
            if (err) return reject(err);
            resolve(result.rows);
        });
    });
}

function updateUser(data) {
    return new Promise((resolve, reject) => {
        pool.query(updateUsuarioData(data), (err, result) => {
            if (err) return reject(err);
            resolve(result.rows);
        });
    });
}

function updateJourneyUser(data) {
    return new Promise((resolve, reject) => {
        pool.query(updateUsuarioJourney(data), (err, result) => {
            if (err) return reject(err);
            resolve(result.rows);
        });
    });
}

function deleteUser(id) {
    return new Promise((resolve, reject) => {
        pool.query(deleteUsuarioData(id), (err, result) => {
            if (err) return reject(err);
            resolve(result.rows);
        });
    });
}

function getUsersForSync() {
    return new Promise((resolve, reject) => {
        pool.query(selectUsersForSync(), (err, data) => {
            if (err) return reject(err);
            resolve(data.rows);
        });
    });
}

function setUserMoodleId(id, moodleId) {
    return new Promise((resolve, reject) => {
        pool.query(updateUserMoodleId(id, moodleId), (err, data) => {
            if (err) return reject(err);
            resolve(data.rows);
        });
    });
}

function removeUserMoodleId(id) {
    return new Promise((resolve, reject) => {
        pool.query(clearUserMoodleId(id), (err, data) => {
            if (err) return reject(err);
            resolve(data.rows);
        });
    });
}

function findUserSicau(email, username) {
    return new Promise((resolve, reject) => {
        pool.query(findUserByEmailOrUsername(email, username), (err, data) => {
            if (err) return reject(err);
            resolve(data.rows);
        });
    });
}

function findUserByDoc(documento) {
    return new Promise((resolve, reject) => {
        pool.query(findUserByDocumento(documento), (err, data) => {
            if (err) return reject(err);
            resolve(data.rows);
        });
    });
}

function updateUserFromSicau(user) {
    return new Promise((resolve, reject) => {
        pool.query(updateUserSicau(user), (err, data) => {
            if (err) return reject(err);
            resolve(data.rows);
        });
    });
}

// ✅ CORREGIDO: ahora updateUserSyncStatusQuery está importado correctamente arriba
function updateUserSyncStatus(id, statusValue) {
    return new Promise((resolve, reject) => {
        pool.query(updateUserSyncStatusQuery(id, statusValue), (err, result) => {
            if (err) return reject(err);
            resolve(result.rows);
        });
    });
}

// ─── COURSES ──────────────────────────────────────────────────────────────────

function insertCourse(data) {
    return new Promise((resolve, reject) => {
        pool.query(insertCourseData(data), (err, result) => {
            if (err) return reject(err);
            resolve(result.rows);
        });
    });
}

function updateCourse(data) {
    return new Promise((resolve, reject) => {
        pool.query(updateCourseData(data), (err, result) => {
            if (err) return reject(err);
            resolve(result.rows);
        });
    });
}

function getCoursesForSync() {
    return new Promise((resolve, reject) => {
        pool.query(selectCoursesForSync(), (err, data) => {
            if (err) return reject(err);
            resolve(data.rows);
        });
    });
}

function setCourseMoodleId(id, moodleId) {
    return new Promise((resolve, reject) => {
        pool.query(updateCourseMoodleId(id, moodleId), (err, data) => {
            if (err) return reject(err);
            resolve(data.rows);
        });
    });
}

function findCourseSicau(idnumber) {
    return new Promise((resolve, reject) => {
        pool.query(findCourseByIdnumber(idnumber), (err, data) => {
            if (err) return reject(err);
            resolve(data.rows);
        });
    });
}

function findCourseByShortnameFn(shortname) {
    return new Promise((resolve, reject) => {
        pool.query(findCourseByShortname(shortname), (err, data) => {
            if (err) return reject(err);
            resolve(data.rows);
        });
    });
}

// ─── ENROLLMENTS ──────────────────────────────────────────────────────────────

function insertEnrollment(data) {
    return new Promise((resolve, reject) => {
        pool.query(insertEnrollmentData(data), (err, result) => {
            if (err) return reject(err);
            resolve(result.rows);
        });
    });
}

function updateEnrollment(data) {
    return new Promise((resolve, reject) => {
        pool.query(updateEnrollmentData(data), (err, result) => {
            if (err) return reject(err);
            resolve(result.rows);
        });
    });
}

function getEnrollmentsForSync() {
    return new Promise((resolve, reject) => {
        pool.query(selectEnrollmentsForSync(), (err, data) => {
            if (err) return reject(err);
            resolve(data.rows);
        });
    });
}

function setEnrollmentMoodleId(id, moodleEnrollmentId) {
    return new Promise((resolve, reject) => {
        pool.query(updateEnrollmentMoodleId(id, moodleEnrollmentId), (err, data) => {
            if (err) return reject(err);
            resolve(data.rows);
        });
    });
}

function findEnrollmentSicau(codigoJourney) {
    return new Promise((resolve, reject) => {
        pool.query(findEnrollmentByCodigoJourney(codigoJourney), (err, data) => {
            if (err) return reject(err);
            resolve(data.rows);
        });
    });
}

function listAllEnrollmentsWithUsers() {
    return new Promise((resolve, reject) => {
        pool.query(findAllEnrollmentsWithUsers(), (err, data) => {
            if (err) return reject(err);
            resolve(data.rows);
        });
    });
}

// ─── HEALTH ───────────────────────────────────────────────────────────────────

function checkDbConnection() {
    return new Promise((resolve, reject) => {
        pool.query(healthCheck(), (err) => {
            if (err) return reject(err);
            resolve(true);
        });
    });
}

// ─── EXPORTS ──────────────────────────────────────────────────────────────────

module.exports = {
    listAll,
    query,
    insertUser,
    updateUser,
    updateJourneyUser,
    deleteUser,
    getUsersForSync,
    setUserMoodleId,
    removeUserMoodleId,
    findUserSicau,
    findUserByDoc,
    updateUserFromSicau,
    updateUserSyncStatus,
    insertCourse,
    updateCourse,
    getCoursesForSync,
    setCourseMoodleId,
    findCourseSicau,
    findCourseByShortnameFn,
    insertEnrollment,
    updateEnrollment,
    getEnrollmentsForSync,
    setEnrollmentMoodleId,
    findEnrollmentSicau,
    listAllEnrollmentsWithUsers,
    checkDbConnection
};