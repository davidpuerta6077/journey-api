
module.exports = (injectedDB) => {
    let data = injectedDB;
    if (!data) 
        data = require('../../database/postgresql');

    function list(tabla) {
        return data.listAll(tabla);
    }

    function healtBd() {
        return data.checkDbConnection();
    }

    return {
        list,
        healtBd 
    };
};