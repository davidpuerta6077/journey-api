module.exports = (injectedDB) => {
    let data = injectedDB;
    if (!data) data = require('../../database/postgresql');

    function list(tabla) {
        return data.listAll(tabla);
    }

    async function addElement(userData) {
        return data.insertUser(userData);
    }

    async function updateElement(userData) {
        return data.updateUser(userData);
    }

    // ─── SICAU ────────────────────────────────────────────────────────────────

    async function saveSicauUsuario(user) {
        const existing = await data.findUserSicau(user.email, user.username);

        if (existing.length > 0) {
            await data.updateUserFromSicau(user);
            return { username: user.username, status: 'updated' };
        } else {
            await data.insertUser({
                username:               user.username,
                firstname:              user.firstname,
                lastname:               user.lastname,
                email:                  user.email,
                password:               user.documento ? String(user.documento) : 'Pascual2024*',
                city:                   user.city                   || 'Medellín',
                country:                user.country                || 'CO',
                documento:              user.documento              || null,
                correo_personal:        user.correo_personal        || null,
                telefono:               user.telefono               || null,
                celular:                user.celular                || null,
                fecha_nacimiento:       user.fecha_nacimiento       || null,
                jornada:                user.jornada                || null,
                departamento_academico: user.departamento_academico || null,
                plan_estudios:          user.plan_estudios          || null,
                moodle_id:              null
            });
            return { username: user.username, status: 'saved' };
        }
    }

    return {
        list,
        addElement,
        updateElement,
        saveSicauUsuario,
    };
};