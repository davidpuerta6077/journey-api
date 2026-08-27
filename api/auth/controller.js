module.exports = (injectedDB) => {
    let data = injectedDB;
    if (!data) 
        data = require('../../database/postgresql');


    return {

    };
};