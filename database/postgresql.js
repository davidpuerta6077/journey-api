const config = require('../config');
const { Pool } = require('pg');
const {
    selectAllItems, insertData, updateData,
    findUserByEmailOrUsername, updateUserSicau,
    findUserByDocumento, findCourseByIdnumber,
    findEnrollmentByCodigoJourney, findAllEnrollmentsWithUsers
} = require('./querysets');

const pool = new Pool({
    database: config.postgresql.database,
    user: config.postgresql.user,
    password: config.postgresql.password,
    host: config.postgresql.host,
    port: config.postgresql.port,
});

function listAll(table) {
    return new Promise((resolve, reject) => {
        pool.query(selectAllItems(table), (err, data) => {
            if (err) return reject(err);
            resolve(data.rows);
        });
    });
}

function insertItem(table, data) {
    return new Promise((resolve, reject) => {
        pool.query(insertData(table, data), (err, data) => {
            if (err) return reject(err);
            resolve(data.rows);
        });
    });
}

function updateItem(table, data) {
    return new Promise((resolve, reject) => {
        pool.query(updateData(table, data), (err, data) => {
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

// ─── FUNCIONES SICAU USUARIOS ─────────────────────────────────────────────────
function findUserSicau(email, username) {
    return new Promise((resolve, reject) => {
        pool.query(findUserByEmailOrUsername(email, username), (err, data) => {
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

// ─── FUNCIONES SICAU MATRÍCULAS ───────────────────────────────────────────────
function findUserByDoc(documento) {
    return new Promise((resolve, reject) => {
        pool.query(findUserByDocumento(documento), (err, data) => {
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

module.exports = {
    listAll,
    insertItem,
    updateItem,
    query,
    findUserSicau,
    updateUserFromSicau,
    findUserByDoc,
    findCourseSicau,
    findEnrollmentSicau,
    listAllEnrollmentsWithUsers
};