const usersCtrl = require('../../api/users/index');
const { moodleRequest } = require('../moodleService');

async function syncStudents(items = []) {
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

            if (user.moodle_id) {
                // Usuario ya existe en Moodle — actualizar datos
                const updateResult = await moodleRequest('core_user_update_users', {
                    'users[0][id]':        user.moodle_id,
                    'users[0][firstname]': user.firstname,
                    'users[0][lastname]':  user.lastname,
                    'users[0][email]':     user.email,
                    'users[0][city]':      user.city    || 'Medellín',
                    'users[0][country]':   user.country || 'CO',
                });
                if (updateResult && updateResult.exception) {
                    throw new Error(updateResult.message);
                }
                result.action = 'updated';
            } else {
                // Usuario nuevo — crear en Moodle
                const createResult = await moodleRequest('core_user_create_users', {
                    'users[0][username]':  (user.username || user.email).toLowerCase(),
                    'users[0][email]':     user.email,
                    'users[0][password]':  user.documento || 'Pascual2024*',
                    'users[0][idnumber]':  user.documento || '',
                    'users[0][firstname]': user.firstname,
                    'users[0][lastname]':  user.lastname,
                    'users[0][city]':      user.city    || 'Medellín',
                    'users[0][country]':   user.country || 'CO',
                    'users[0][auth]':      'manual',
                });
                if (createResult && createResult.exception) {
                    throw new Error(createResult.message);
                }
                if (!Array.isArray(createResult) || createResult.length === 0) {
                    throw new Error('Moodle no devolvió un ID de usuario');
                }
                await usersCtrl.updateMoodleId(user.id, createResult[0].id);
                result.moodle_id = createResult[0].id;
                result.action = 'created';
            }

            await usersCtrl.markAsSynchronized(user.id);
            result.status = 'success';
            result.message = result.action === 'created'
                ? 'Usuario creado en Moodle y marcado como sincronizado.'
                : 'Usuario actualizado en Moodle y marcado como sincronizado.';

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
