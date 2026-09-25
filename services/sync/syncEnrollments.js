const enrollmentsCtrl = require('../../api/enrollments/index');
const coursesCtrl = require('../../api/courses/index');
const { logSyncError } = require('../syncLog');

// Hasta 2026-09 esta función llamaba a enrol_manual_enrol_users/unenrol_users
// por webservice para aplicar la matrícula en Moodle. Eso duplicaba al
// estudiante bajo DOS métodos de inscripción a la vez: "Manual" (el que
// creaba esta llamada) y "Base de datos externa" (el plugin enrol_database,
// que Moodle ya tenía configurado desde antes apuntando a la vista
// test.moodle_enrol — ver database/seeds/fixMoodleExternalDbViews.js). La
// matrícula real en Moodle ahora la hace exclusivamente el cron de Moodle
// leyendo esa vista, que a su vez lee directo de enrollments.estado. El único
// trabajo de esta función es dejar bien guardado el estado local — igual que
// ya hacía syncStudents.js para usuarios ("el cron de Moodle procesará este
// registro") — y avisar si el curso todavía no existe en Moodle.
const ESTADOS_PENDIENTES = ['pendiente'];

async function syncEnrollments(items = [], username = 'system') {
    const results = [];

    for (const enr of items) {
        const result = { id: enr.id, cedula: enr.documento };

        try {
            if (!enr.id) {
                throw new Error('Sin ID de matrícula');
            }

            const estadoNorm = (enr.estado || '').trim().toLowerCase();
            if (ESTADOS_PENDIENTES.includes(estadoNorm)) {
                result.status = 'pendiente';
                result.message = 'Estado académico "Pendiente": aún no hay nada que sincronizar con Moodle';
                results.push(result);
                continue;
            }

            // ─── Curso: match por idnumber = código journey ────────────────────
            // El curso ya debe existir en Moodle (lo crea sync-courses, independiente
            // de este módulo). moodle_enrol solo puede resolverlo si courses.idnumber
            // ya quedó fijado en Moodle.
            const codigoJourney = enr.codigo_journey || `${enr.codigo_asignatura}${enr.periodo}${enr.grupo}`;
            const course = await coursesCtrl.findByIdnumber(codigoJourney);

            if (!course || !course.moodle_id) {
                result.status = 'pendiente';
                result.message = 'El curso aún no existe en Moodle (pendiente de sync-courses)';
                results.push(result);
                continue;
            }

            // No hay nada más que verificar contra Moodle aquí: el cron de la BD
            // externa resuelve usuario/curso/rol por sí mismo en su próxima
            // corrida (matricula, desmatricula o deja igual según lo que vea en
            // moodle_enrol). "traslado" se conserva tal cual: una vez el cron
            // desmatricule al estudiante del curso viejo (porque esa fila deja
            // de tener un estado activo), la matrícula nueva ya está lista para
            // aparecer ahí mismo.
            await enrollmentsCtrl.setEnrollmentSyncFields(enr.id, {
                courseid: course.id,
                moodle_enrollment_id: null,
                sincronizado: true,
                estado_sync: 'sincronizado'
            });

            result.status = 'success';
            result.message = 'Guardado en Nexo. El cron de Moodle (Base de datos externa) aplicará el cambio en su próxima corrida.';

        } catch (error) {
            console.error('Error sincronizando matrícula:', enr.id, error.message);
            result.status = 'error';
            result.error = error.message;
            if (enr.id) {
                await enrollmentsCtrl.markEnrollmentSyncFailed(enr.id, error.message);
                await logSyncError('enrollment', enr.id, error.message, username);
            }
        }

        results.push(result);
    }

    return { results };
}

module.exports = { syncEnrollments };
