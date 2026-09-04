module.exports = (injectedDB) => {
    let data = injectedDB;
    if (!data) 
        data = require('../../database/postgresql');

    async function permissions(email) {
        return data.checkPermissionsData(email)
    };

    async function me(email) {
        const result = await data.findPlatformUserByEmail(email);
        return result[0] || null;
    };

    async function updateMyPhoto(email, photoUrl) {
        const result = await data.updatePlatformUserPhoto(email, photoUrl);
        return result[0];
    };

    return {
        permissions,
        me,
        updateMyPhoto
    };
};