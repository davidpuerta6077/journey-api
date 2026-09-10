const db = require('../../../database/postgresql');
const config = require('../../../config');
const { meta } = require('../_util');
const schema = config.postgresql.schema;

async function usersNotSynced(params = {}) {
    const rows = await db.query({
        text: `SELECT id, username, firstname, lastname, email, moodle_id, sincronizado
               FROM ${schema}.users
               WHERE sincronizado IS NOT TRUE OR moodle_id IS NULL
               ORDER BY id DESC`,
        values: [],
    });
    return {
        columns: [
            { key: 'id', label: 'ID' },
            { key: 'username', label: 'Usuario' },
            { key: 'firstname', label: 'Nombre' },
            { key: 'lastname', label: 'Apellido' },
            { key: 'email', label: 'Correo' },
            { key: 'moodle_id', label: 'Moodle ID' },
            { key: 'sincronizado', label: 'Sincronizado' },
        ],
        rows: rows.map((r) => ({
            id: r.id,
            username: r.username,
            firstname: r.firstname,
            lastname: r.lastname,
            email: r.email,
            moodle_id: r.moodle_id,
            sincronizado: r.sincronizado,
        })),
        meta: meta('journey_users_not_synced', params),
    };
}
module.exports = { usersNotSynced };
