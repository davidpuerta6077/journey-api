const db = require('../../../database/postgresql');
const config = require('../../../config');
const { meta } = require('../_util');
const schema = config.postgresql.schema;

async function enrollmentsByStatus(params = {}) {
    const rows = await db.query({
        text: `SELECT COALESCE(estado,'(sin estado)') AS estado, COALESCE(sincronizado,false) AS sincronizado, COUNT(*)::int AS cantidad
               FROM ${schema}.enrollments GROUP BY 1,2 ORDER BY cantidad DESC`,
        values: [],
    });
    return {
        columns: [
            { key: 'estado', label: 'Estado' },
            { key: 'sincronizado', label: 'Sincronizada' },
            { key: 'cantidad', label: 'Cantidad' },
        ],
        rows: rows.map((r) => ({ estado: r.estado, sincronizado: r.sincronizado, cantidad: r.cantidad })),
        meta: meta('journey_enrollments_by_status', params),
    };
}
module.exports = { enrollmentsByStatus };
