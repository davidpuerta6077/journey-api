module.exports = (injectedDB) => {
    let data = injectedDB;
    if (!data) 
        data = require('../../database/postgresql');

    async function permissions(email) {
        return data.checkPermissionsData(email)
    };

    return {
        permissions
    };
};