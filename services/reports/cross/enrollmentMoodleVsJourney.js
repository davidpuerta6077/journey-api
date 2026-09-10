const db = require('../../../database/postgresql');
const { getEnrolados, tieneRol } = require('../moodle/_moodleRest');
const { meta } = require('../_util');

async function enrollmentMoodleVsJourney(params = {}) {
    const courseid = Number(params.courseid);
    if (params.courseid === '' || params.courseid == null || !Number.isInteger(courseid) || courseid <= 0) {
        const err = new Error('courseid (id de curso Journey) es obligatorio');
        err.status = 400;
        throw err;
    }

    const [curso] = await db.reportCourseById(courseid);
    if (!curso) {
        const err = new Error('Curso Journey ' + courseid + ' no encontrado');
        err.status = 400;
        throw err;
    }

    const [{ n }] = await db.reportEnrollmentCountByCourse(courseid);

    let enMoodle = null;
    if (curso.moodle_id) {
        const enrol = await getEnrolados(curso.moodle_id);
        enMoodle = Array.isArray(enrol) ? enrol.filter((u) => tieneRol(u, 'student')).length : null;
    }

    return {
        columns: [
            { key: 'curso', label: 'Curso' },
            { key: 'en_journey', label: 'En Journey' },
            { key: 'en_moodle', label: 'En Moodle' },
            { key: 'diferencia', label: 'Diferencia' },
        ],
        rows: [
            {
                curso: curso.shortname,
                en_journey: n,
                en_moodle: enMoodle,
                diferencia: enMoodle != null ? enMoodle - n : null,
            },
        ],
        meta: meta('enrollment_moodle_vs_journey', { courseid }),
    };
}
module.exports = { enrollmentMoodleVsJourney };
