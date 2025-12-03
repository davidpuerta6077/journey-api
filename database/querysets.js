const config = require('../config.js'); 

const schema = config.postgresql.schema

const selectAllItems = (table, id) => {
    const pId = id
    const query = 
    `SELECT * FROM ${table}`
    return query
}

const insertData = (table, jsonData) => {
    const { data } = jsonData;
    const query = `
    INSERT INTO ${table} 
    (data) VALUES ('${data}')`;
    return query;
  }

const updateData = (table, jsonData) => {
    const { id, type, description, username } = jsonData;
    const query = 
    `UPDATE ${schema}.${table} 
    SET type = '$1', description = '$2', username = '$3' 
    WHERE id = $4`;
    return {query, values: [type, description, username, id]};
}

module.exports = {
    selectAllItems,
    insertData, 
    updateData
}