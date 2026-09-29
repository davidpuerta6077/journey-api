const db = require('../../../database/postgresql');
const { meta, moodleCourseUrl } = require('../util');

async function coursesBySyncStatus(params = {}) {
    const [rows, cursos] = await Promise.all([db.reportCoursesBySyncStatus(), db.reportCoursesDetail()]);
    return {
        columns: [
            { key: 'estado', label: 'Estado' },
            { key: 'cantidad', label: 'Cantidad' },
        ],
        rows: rows.map((r) => ({ estado: r.estado, cantidad: r.cantidad })),
        detalle: {
            titulo: 'Cursos',
            columns: [
                { key: 'idnumber', label: 'Código curso' },
                { key: 'fullname', label: 'Curso', link: 'moodle_url' },
                { key: 'periodo', label: 'Período' },
                { key: 'estado', label: 'Estado' },
                { key: 'ultimo_error_sync', label: 'Último error' },
                { key: 'synced_at', label: 'Sincronizado el' },
            ],
            rows: cursos.map((c) => ({ ...c, moodle_url: moodleCourseUrl(c.moodle_id) })),
        },
        meta: meta('journey_courses_by_sync_status', params),
    };
}
module.exports = { coursesBySyncStatus };
