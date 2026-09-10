const db = require('../../../database/postgresql');
const config = require('../../../config');
const { meta } = require('../_util');
const schema = config.postgresql.schema;

async function coursesBySyncStatus(params = {}) {
    const rows = await db.query({
        text: `SELECT COALESCE(estado_sync,'(sin estado)') AS estado, COUNT(*)::int AS cantidad
               FROM ${schema}.courses GROUP BY 1 ORDER BY cantidad DESC`,
        values: [],
    });
    return {
        columns: [
            { key: 'estado', label: 'Estado' },
            { key: 'cantidad', label: 'Cantidad' },
        ],
        rows: rows.map((r) => ({ estado: r.estado, cantidad: r.cantidad })),
        meta: meta('journey_courses_by_sync_status', params),
    };
}
module.exports = { coursesBySyncStatus };
