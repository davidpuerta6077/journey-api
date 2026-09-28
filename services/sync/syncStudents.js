const usersCtrl = require('../../api/users/index');
const { normalizeUser, difiere } = require('../normalize');

const CAMPOS_NORM = ['firstname', 'lastname', 'email', 'correo_personal', 'jornada', 'departamento_academico', 'plan_estudios'];

async function syncStudents(items = [], username = 'system') {
    const results = [];

    for (const user of items) {
        const result = { id: user.id, username: user.username, email: user.email };

        try {
            if (!user.id) {
                result.status = 'error';
                result.error = 'Sin ID de usuario';
                results.push(result);
                continue;
            }

            // Normalizar antes de sincronizar: si cambió algo, se persiste en la
            // BD de Nexo para que el cron de Moodle lea el dato ya limpio. A
            // Moodle no se le escribe nada por webservice (solo BD externa, ver
            // CLAUDE.md), ni siquiera para corregir el nombre de un usuario que
            // ya existe allá.
            if (user.firstname !== undefined || user.lastname !== undefined) {
                const candidato = normalizeUser(user);
                if (difiere(user, candidato, CAMPOS_NORM)) {
                    await usersCtrl.applyNormalization(user.id, candidato);
                    result.normalized = true;
                }
            }

            await usersCtrl.markAsSynchronized(user.id);
            result.status = 'success';
            result.message = 'Marcado como sincronizado. El cron de Moodle procesará este registro.';

        } catch (error) {
            console.error('Error sincronizando usuario:', user.username, error.message);
            result.status = 'error';
            result.error = error.message;
        }

        results.push(result);
    }

    return { results };
}

module.exports = { syncStudents };
