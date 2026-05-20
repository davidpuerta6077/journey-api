const config = require('../config');
const { Pool } = require('pg');
const {
    selectAllItems,
    // users
    selectAllUsers,
    insertUsuarioData,
    updateUsuarioData,
    findUserByEmailOrUsername,
    findUserByDocumento,
    updateUserSicau,
    // courses
    selectAllCourses,
    insertCourseData,
    updateCourseData,
    findCourseByIdnumber,
    // enrollments
    selectAllEnrollments,
    insertEnrollmentData,
    updateEnrollmentData,
    findEnrollmentByCodigoJourney,
    findAllEnrollmentsWithUsers,
    // health
    healthCheck,
} = require('./querysets');

const pool = new Pool({
    database: config.postgresql.database,
    user:     config.postgresql.user,
    password: config.postgresql.password,
    host:     config.postgresql.host,
    port:     config.postgresql.port,
});

// ─── GENERIC ──────────────────────────────────────────────────────────────────

function listAll(table) {
    return new Promise((resolve, reject) => {
        const { query, values } = selectAllItems(table);
        pool.query(query, values, (err, data) => {
            if (err) return reject(err);
            resolve(data.rows);
        });
    });
}

// ─── USERS ────────────────────────────────────────────────────────────────────

function listAllUsers() {
    return new Promise((resolve, reject) => {
        const { query, values } = selectAllUsers();
        pool.query(query, values, (err, data) => {
            if (err) return reject(err);
            resolve(data.rows);
        });
    });
}

function insertUser(data) {
    return new Promise((resolve, reject) => {
        const { query, values } = insertUsuarioData(data);
        pool.query(query, values, (err, data) => {
            if (err) return reject(err);
            resolve(data.rows);
        });
    });
}

function updateUser(data) {
    return new Promise((resolve, reject) => {
        const { query, values } = updateUsuarioData(data);
        pool.query(query, values, (err, data) => {
            if (err) return reject(err);
            resolve(data.rows);
        });
    });
}

function findUserSicau(email, username) {
    return new Promise((resolve, reject) => {
        const { query, values } = findUserByEmailOrUsername(email, username);
        pool.query(query, values, (err, data) => {
            if (err) return reject(err);
            resolve(data.rows);
        });
    });
}

function findUserByDoc(documento) {
    return new Promise((resolve, reject) => {
        const { query, values } = findUserByDocumento(documento);
        pool.query(query, values, (err, data) => {
            if (err) return reject(err);
            resolve(data.rows);
        });
    });
}

function updateUserFromSicau(data) {
    return new Promise((resolve, reject) => {
        const { query, values } = updateUserSicau(data);
        pool.query(query, values, (err, data) => {
            if (err) return reject(err);
            resolve(data.rows);
        });
    });
}

// ─── COURSES ──────────────────────────────────────────────────────────────────

function listAllCourses() {
    return new Promise((resolve, reject) => {
        const { query, values } = selectAllCourses();
        pool.query(query, values, (err, data) => {
            if (err) return reject(err);
            resolve(data.rows);
        });
    });
}

function insertCourse(data) {
    return new Promise((resolve, reject) => {
        const { query, values } = insertCourseData(data);
        pool.query(query, values, (err, data) => {
            if (err) return reject(err);
            resolve(data.rows);
        });
    });
}

function updateCourse(data) {
    return new Promise((resolve, reject) => {
        const { query, values } = updateCourseData(data);
        pool.query(query, values, (err, data) => {
            if (err) return reject(err);
            resolve(data.rows);
        });
    });
}

function findCourseSicau(idnumber) {
    return new Promise((resolve, reject) => {
        const { query, values } = findCourseByIdnumber(idnumber);
        pool.query(query, values, (err, data) => {
            if (err) return reject(err);
            resolve(data.rows);
        });
    });
}

// ─── ENROLLMENTS ──────────────────────────────────────────────────────────────

function listAllEnrollments() {
    return new Promise((resolve, reject) => {
        const { query, values } = selectAllEnrollments();
        pool.query(query, values, (err, data) => {
            if (err) return reject(err);
            resolve(data.rows);
        });
    });
}

function insertEnrollment(data) {
    return new Promise((resolve, reject) => {
        const { query, values } = insertEnrollmentData(data);
        pool.query(query, values, (err, data) => {
            if (err) return reject(err);
            resolve(data.rows);
        });
    });
}

function updateEnrollment(data) {
    return new Promise((resolve, reject) => {
        const { query, values } = updateEnrollmentData(data);
        pool.query(query, values, (err, data) => {
            if (err) return reject(err);
            resolve(data.rows);
        });
    });
}

function findEnrollmentSicau(codigoJourney) {
    return new Promise((resolve, reject) => {
        const { query, values } = findEnrollmentByCodigoJourney(codigoJourney);
        pool.query(query, values, (err, data) => {
            if (err) return reject(err);
            resolve(data.rows);
        });
    });
}

function listAllEnrollmentsWithUsers() {
    return new Promise((resolve, reject) => {
        const { query, values } = findAllEnrollmentsWithUsers();
        pool.query(query, values, (err, data) => {
            if (err) return reject(err);
            resolve(data.rows);
        });
    });
}

// ─── HEALTH ───────────────────────────────────────────────────────────────────

function checkHealth() {
    return new Promise((resolve, reject) => {
        const { query, values } = healthCheck();
        pool.query(query, values, (err) => {
            if (err) return reject(err);
            resolve(true);
        });
    });
}

// ─── EXPORTS ──────────────────────────────────────────────────────────────────

module.exports = {
    listAll,
    // users
    listAllUsers,
    insertUser,
    updateUser,
    findUserSicau,
    findUserByDoc,
    updateUserFromSicau,
    // courses
    listAllCourses,
    insertCourse,
    updateCourse,
    findCourseSicau,
    // enrollments
    listAllEnrollments,
    insertEnrollment,
    updateEnrollment,
    findEnrollmentSicau,
    listAllEnrollmentsWithUsers,
    // health
    checkDbConnection: checkHealth,
};