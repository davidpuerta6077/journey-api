const db = require('../../../database/postgresql');
const { meta } = require('../_util');

async function enrollmentsByStatus(params = {}) {
    const rows = await db.reportEnrollmentsByStatus();
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
