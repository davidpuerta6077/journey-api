module.exports = (injectedDB) => {
    let data = injectedDB;
    if (!data) data = require('../../database/postgresql');

    async function checkHealth() {
        const dbOk = await data.checkDbConnection();
        return {
            status: 'ok',
            db: dbOk ? 'ok' : 'error',
            timestamp: new Date().toISOString()
        };
    }

    return {
        checkHealth
    };
};