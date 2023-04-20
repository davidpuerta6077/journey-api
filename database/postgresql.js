const config = require('../config');
const { Pool } = require('pg')
const { selectAllItems, insertData, updateData } = require('./querysets');

const pool = new Pool({
    'database': config.postgresql.database,
    'user': config.postgresql.user,
    'password': config.postgresql.password,
    'host': config.postgresql.host,
    'port': config.postgresql.port,
});

function listAll(table){
    return new Promise((resolve, reject) => {
        const query = selectAllItems(table)
        pool.query(query, (err, data) => {
            if (err) return reject(err);
            resolve(data.rows);
        });
    });
};

function insertItem(table, data){
    return new Promise((resolve, reject) => {
        const query = insertData(table, data)
        pool.query(query, (err, data) =>{
            if (err) return reject(err); 
            resolve(data.rows);
        });
    });
};

function updateItem(table, data){
    return new Promise((resolve, reject) => {
        const query = updateData(table, data)
        pool.query(query, (err, data) =>{
            if (err) return reject(err); 
            resolve(data.rows);
        });
    });
};


module.exports = {
    listAll,
    insertItem,
    updateItem
}