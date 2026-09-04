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

    async function updateMyUsername(email, username) {
        try {
            const result = await data.updatePlatformUserUsername(email, username);
            return result[0];
        } catch (err) {
            if (err.code === '23505') {
                const dupErr = new Error('Ese nombre de usuario ya está en uso');
                dupErr.status = 409;
                throw dupErr;
            }
            throw err;
        }
    };

    return {
        permissions,
        me,
        updateMyPhoto,
        updateMyUsername
    };
};