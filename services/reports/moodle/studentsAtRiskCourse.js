const { getEnrolados, tieneRol, diasDesde, fechaCorta } = require('./moodleRest');
const { meta, normInt } = require('../util');

async function studentsAtRiskCourse(params = {}) {
    const courseid = Number(params.courseid);
    if (params.courseid === '' || params.courseid == null || !Number.isInteger(courseid) || courseid <= 0) {
        const err = new Error('courseid es obligatorio y numérico');
        err.status = 400;
        throw err;
    }
    const diasSinAcceso = normInt(params.diasSinAcceso, 30);

    const enrolados = await getEnrolados(courseid);
    if (!enrolados) {
        throw new Error('No se pudieron obtener los matriculados del curso ' + courseid);
    }

    const estudiantes = enrolados.filter((u) => tieneRol(u, 'student'));
    const enRiesgo = estudiantes.filter(
        (u) => u.lastcourseaccess === 0 || !u.lastcourseaccess || diasDesde(u.lastcourseaccess) >= diasSinAcceso
    );

    return {
        columns: [
            { key: 'nombre', label: 'Estudiante' },
            { key: 'email', label: 'Correo' },
            { key: 'username', label: 'Usuario' },
            { key: 'ultimo_acceso_curso', label: 'Últ. acceso al curso' },
            { key: 'dias_inactivo', label: 'Días inactivo' },
        ],
        rows: enRiesgo.map((u) => ({
            nombre: u.fullname,
            email: u.email,
            username: u.username,
            ultimo_acceso_curso: fechaCorta(u.lastcourseaccess),
            dias_inactivo: diasDesde(u.lastcourseaccess),
        })),
        meta: meta('moodle_students_at_risk_course', { courseid, diasSinAcceso }),
    };
}
module.exports = { studentsAtRiskCourse };
