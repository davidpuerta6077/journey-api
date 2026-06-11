const enrollmentsCtrl = require('../../api/enrollments/index');
const database = require('../../database/postgresql');

async function syncEnrollments(items = []) {
    const results = [];

    const allUsers = await database.getUsersForSync();
    const syncedUserIds = new Set(allUsers.filter(u => u.sincronizado).map(u => u.id));

    for (const enr of items) {
        const result = { id: enr.id, userid: enr.userid, courseid: enr.courseid };

        try {
            if (!enr.id) {
                result.status = 'error';
                result.error = 'Sin ID de matrícula';
                results.push(result);
                continue;
            }

            if (!syncedUserIds.has(enr.userid)) {
                result.status = 'error';
                result.error = 'El usuario no está sincronizado en Moodle todavía';
                results.push(result);
                continue;
            }

            await enrollmentsCtrl.markEnrollmentAsSynchronized(enr.id);
            result.status = 'success';
            result.message = 'Marcada como sincronizada. El cron de Moodle procesará este registro.';

        } catch (error) {
            result.status = 'error';
            result.error = error.message;
        }

        results.push(result);
    }

    return { results };
}

module.exports = { syncEnrollments };