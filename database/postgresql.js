const config = require('../config');
const { Pool } = require('pg');
const { selectAllItems, insertData, updateData } = require('./querysets');

const pool = new Pool({
    database: config.postgresql.database,
    user: config.postgresql.user,
    password: config.postgresql.password,
    host: config.postgresql.host,
    port: config.postgresql.port,
});

function listAll(table) {
    return new Promise((resolve, reject) => {
        const queryConfig = selectAllItems(table);
        pool.query(queryConfig, (err, data) => {
            if (err) return reject(err);
            resolve(data.rows);
        });
    });
}

function insertItem(table, data) {
    return new Promise((resolve, reject) => {
        const queryConfig = insertData(table, data);
        pool.query(queryConfig, (err, data) => {
            if (err) return reject(err);
            resolve(data.rows);
        });
    });
}

function updateItem(table, data) {
    return new Promise((resolve, reject) => {
        const queryConfig = updateData(table, data);
        pool.query(queryConfig, (err, data) => {
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

module.exports = {
    listAll,
    insertItem,
    updateItem,
    query
};