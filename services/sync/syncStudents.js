const usersCtrl = require('../../api/users/index');

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