const db = require('../../../database/postgresql');
const { meta } = require('../util');

async function coursesBySyncStatus(params = {}) {
    const rows = await db.reportCoursesBySyncStatus();
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
