const db = require('../../../database/postgresql');
const { getEnrolados, tieneRol } = require('../moodle/moodleRest');
const { meta, moodleCourseUrl, moodleUserUrl } = require('../util');

// Estados de matrícula Nexo que deberían estar en Moodle (ver vista moodle_enrol).
const ACTIVOS = ['matriculado', 'matriculada', 'activa'];

async function enrollmentMoodleVsJourney(params = {}) {
    const courseid = Number(params.courseid);
    if (params.courseid === '' || params.courseid == null || !Number.isInteger(courseid) || courseid <= 0) {
        const err = new Error('courseid (id de curso Nexo) es obligatorio');
        err.status = 400;
        throw err;
    }

    const [curso] = await db.reportCourseById(courseid);
    if (!curso) {
        const err = new Error('Curso Nexo ' + courseid + ' no encontrado');
        err.status = 400;
        throw err;
    }

    // Nexo: estudiantes con matrícula activa en el curso.
    const nexo = (await db.reportEnrollmentsOfCourse(courseid))
        .filter((e) => e.role === 'student' && ACTIVOS.includes(String(e.estado || '').toLowerCase()));

    // Moodle: estudiantes matriculados (null si el webservice no respondió).
    let moodle = null;
    if (curso.moodle_id) {
        const enrol = await getEnrolados(curso.moodle_id);
        moodle = Array.isArray(enrol) ? enrol.filter((u) => tieneRol(u, 'student')) : null;
    }

    // Se cruzan por documento (es el username/idnumber en Moodle, ver
    // database/seeds/fixMoodleExternalDbViews.js) y, de respaldo, por email.
    const clave = (v) => String(v || '').trim().toLowerCase();
    const detalle = [];
    const vistos = new Set();
    for (const e of nexo) {
        const m = moodle?.find((u) =>
            (e.documento && [clave(u.username), clave(u.idnumber)].includes(clave(e.documento))) ||
            (e.email && clave(u.email) === clave(e.email)));
        if (m) vistos.add(m.id);
        detalle.push({
            nombre: e.nombre,
            documento: e.documento,
            email: e.email,
            situacion: moodle == null ? 'Sin datos de Moodle' : m ? 'En ambos' : 'Solo en Nexo',
            perfil_url: m ? moodleUserUrl(m.id) : null,
        });
    }
    for (const u of moodle || []) {
        if (vistos.has(u.id)) continue;
        detalle.push({
            nombre: u.fullname,
            documento: u.idnumber || u.username,
            email: u.email,
            situacion: 'Solo en Moodle',
            perfil_url: moodleUserUrl(u.id),
        });
    }

    const enMoodle = moodle ? moodle.length : null;
    return {
        columns: [
            { key: 'curso', label: 'Curso' },
            { key: 'en_journey', label: 'En Nexo' },
            { key: 'en_moodle', label: 'En Moodle' },
            { key: 'diferencia', label: 'Diferencia' },
        ],
        rows: [
            {
                curso: curso.shortname,
                curso_url: moodleCourseUrl(curso.moodle_id),
                en_journey: nexo.length,
                en_moodle: enMoodle,
                diferencia: enMoodle != null ? enMoodle - nexo.length : null,
                solo_nexo: detalle.filter((d) => d.situacion === 'Solo en Nexo').length,
                solo_moodle: detalle.filter((d) => d.situacion === 'Solo en Moodle').length,
            },
        ],
        detalle: {
            titulo: 'Estudiantes',
            columns: [
                { key: 'nombre', label: 'Estudiante', link: 'perfil_url' },
                { key: 'documento', label: 'Documento' },
                { key: 'email', label: 'Correo' },
                { key: 'situacion', label: 'Situación' },
            ],
            rows: detalle,
        },
        meta: meta('enrollment_moodle_vs_journey', { courseid }),
    };
}
module.exports = { enrollmentMoodleVsJourney };
