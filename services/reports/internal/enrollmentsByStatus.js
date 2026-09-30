const db = require('../../../database/postgresql');
const { meta } = require('../util');

const ROL = { student: 'Estudiante', editingteacher: 'Profesor', teacher: 'Tutor' };

async function enrollmentsByStatus(params = {}) {
    const [rows, matriculas] = await Promise.all([db.reportEnrollmentsByStatus(), db.reportEnrollmentsDetail()]);
    return {
        columns: [
            { key: 'estado', label: 'Estado' },
            { key: 'sincronizado', label: 'Sincronizada' },
            { key: 'cantidad', label: 'Cantidad' },
        ],
        rows: rows.map((r) => ({ estado: r.estado, sincronizado: r.sincronizado, cantidad: r.cantidad })),
        detalle: {
            titulo: 'Matrículas',
            columns: [
                { key: 'estudiante', label: 'Estudiante' },
                { key: 'documento', label: 'Documento' },
                { key: 'email', label: 'Correo' },
                { key: 'codigo_journey', label: 'Código curso' },
                { key: 'nombre_asignatura', label: 'Asignatura' },
                { key: 'periodo', label: 'Período' },
                { key: 'rol', label: 'Rol' },
                { key: 'estado', label: 'Estado' },
                { key: 'sincronizado', label: 'Sincronizada' },
                { key: 'fecha', label: 'Fecha matrícula' },
            ],
            rows: matriculas.map((m) => ({ ...m, rol: ROL[m.role] || m.role })),
        },
        meta: meta('journey_enrollments_by_status', params),
    };
}
module.exports = { enrollmentsByStatus };
