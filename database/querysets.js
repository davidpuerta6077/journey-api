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
    const { id, data } = jsonData;
    const query = 
    `UPDATE ${table} 
    SET data = '${data}'
    WHERE id = ${id}`;
    return query;
}

module.exports = {
    selectAllItems,
    insertData, 
    updateData
}