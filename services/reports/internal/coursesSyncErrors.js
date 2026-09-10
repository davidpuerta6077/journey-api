const db = require('../../../database/postgresql');
const config = require('../../../config');
const { meta } = require('../_util');
const schema = config.postgresql.schema;

async function coursesSyncErrors(params = {}) {
    const rows = await db.query({
        text: `SELECT id, shortname, fullname, estado_sync, ultimo_error_sync
               FROM ${schema}.courses
               WHERE estado_sync = 'error' OR (ultimo_error_sync IS NOT NULL AND ultimo_error_sync <> '')
               ORDER BY id DESC`,
        values: [],
    });
    return {
        columns: [
            { key: 'id', label: 'ID' },
            { key: 'shortname', label: 'Nombre corto' },
            { key: 'fullname', label: 'Nombre' },
            { key: 'estado_sync', label: 'Estado' },
            { key: 'ultimo_error_sync', label: 'Último error' },
        ],
        rows: rows.map((r) => ({
            id: r.id,
            shortname: r.shortname,
            fullname: r.fullname,
            estado_sync: r.estado_sync,
            ultimo_error_sync: r.ultimo_error_sync,
        })),
        meta: meta('journey_courses_sync_errors', params),
    };
}
module.exports = { coursesSyncErrors };
