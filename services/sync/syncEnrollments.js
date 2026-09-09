const enrollmentsCtrl = require('../../api/enrollments/index');
const coursesCtrl = require('../../api/courses/index');
const { moodleRequest } = require('../moodleService');
const { assertMoodleOk } = require('../moodleAssert');
const { logSyncError } = require('../syncLog');
const { getMoodleEnrolmentId } = require('../moodle/getMoodleEnrolment');

// Rol local (ya normalizado a string de Moodle por el módulo de ingreso SICAU:
// ESTUDIANTE→student, DOCENTE→editingteacher, TUTOR→teacher; "gestor" solo se
// asigna manualmente desde Módulos > Matrículas) → roleid numérico que espera Moodle.
const ROLE_ID_MAP = {
    student:        5,
    editingteacher: 3,
    teacher:        4,
    gestor:         1
};

// Mapeo de estado académico (SICAU + edición manual) → acción sobre la matrícula en Moodle.
const ESTADOS_ACTIVOS    = ['matriculado', 'activa'];
const ESTADOS_SUSPENDIDOS = ['suspendido'];
// "finalizada" es el valor legado que ya ofrecía el formulario manual; se trata igual que "finalizado".
const ESTADOS_BAJA = ['retirado', 'cancelada', 'finalizado', 'finalizada'];

async function resolveMoodleUsersByDocumento(documentos) {
    const uniqueDocs = [...new Set(documentos.filter(Boolean))];
    const byDocumento = {};
    if (uniqueDocs.length === 0) return { byDocumento, lookupFailed: false };

    const params = { field: 'idnumber' };
    uniqueDocs.forEach((doc, i) => { params[`values[${i}]`] = doc; });

    const result = await moodleRequest('core_user_get_users_by_field', params);
    if (result === null) {
        return { byDocumento, lookupFailed: true };
    }
    if (Array.isArray(result)) {
        result.forEach(u => { byDocumento[u.idnumber] = u; });
    }
    return { byDocumento, lookupFailed: false };
}

async function syncEnrollments(items = [], username = 'system') {
    const results = [];

    const { byDocumento: moodleUsersByDocumento, lookupFailed: userLookupFailed } =
        await resolveMoodleUsersByDocumento(items.map(e => e.documento));

    for (const enr of items) {
        const result = { id: enr.id, cedula: enr.documento };

        try {
            if (!enr.id) {
                throw new Error('Sin ID de matrícula');
            }

            // ─── Curso: match por idnumber = código journey ────────────────────
            // El curso ya debe existir en Moodle (lo crea sync-courses, independiente
            // de este módulo). Se confía en courses.moodle_id, ya que idnumber es la
            // clave determinística que sync-courses fija al crearlo.
            const codigoJourney = enr.codigo_journey || `${enr.codigo_asignatura}${enr.periodo}${enr.grupo}`;
            const course = await coursesCtrl.findByIdnumber(codigoJourney);

            if (!course || !course.moodle_id) {
                result.status = 'pendiente';
                result.message = 'El curso aún no existe en Moodle (pendiente de sync-courses)';
                results.push(result);
                continue;
            }

            // ─── Usuario: match por idnumber = cédula (nunca por username) ─────
            const moodleUser = enr.documento ? moodleUsersByDocumento[enr.documento] : null;
            if (!moodleUser) {
                if (userLookupFailed) {
                    throw new Error('No se pudo verificar el usuario en Moodle (posible caída o timeout)');
                }
                result.status = 'usuario_no_existe';
                result.message = 'Usuario no existe en Moodle';
                results.push(result);
                continue; // lo resuelve sync-usuarios por separado; se reintenta en la siguiente corrida
            }

            const roleid = ROLE_ID_MAP[enr.role];
            if (!roleid) {
                throw new Error(`Rol "${enr.role}" no tiene un roleid de Moodle asignado`);
            }

            const estadoNorm = (enr.estado || '').trim().toLowerCase();
            let mensaje;

            if (ESTADOS_BAJA.includes(estadoNorm)) {
                const unenrolResp = await moodleRequest('enrol_manual_unenrol_users', {
                    'enrolments[0][userid]':   moodleUser.id,
                    'enrolments[0][courseid]': course.moodle_id
                });
                assertMoodleOk(unenrolResp, 'Error al desmatricular en Moodle');

                await enrollmentsCtrl.setEnrollmentSyncFields(enr.id, {
                    courseid: course.id,
                    moodle_enrollment_id: null,
                    sincronizado: true
                });
                mensaje = 'Desmatriculado en Moodle';
                result.moodle_enrollment_id = null;

            } else if (ESTADOS_ACTIVOS.includes(estadoNorm) || ESTADOS_SUSPENDIDOS.includes(estadoNorm)) {
                const suspend = ESTADOS_SUSPENDIDOS.includes(estadoNorm) ? 1 : 0;
                const enrolResp = await moodleRequest('enrol_manual_enrol_users', {
                    'enrolments[0][userid]':   moodleUser.id,
                    'enrolments[0][courseid]': course.moodle_id,
                    'enrolments[0][roleid]':   roleid,
                    'enrolments[0][suspend]':  suspend
                });
                assertMoodleOk(enrolResp, 'Error al matricular/actualizar en Moodle');

                const moodleEnrollmentId = await getMoodleEnrolmentId(course.moodle_id, moodleUser.id);

                await enrollmentsCtrl.setEnrollmentSyncFields(enr.id, {
                    courseid: course.id,
                    moodle_enrollment_id: moodleEnrollmentId,
                    sincronizado: true
                });
                mensaje = suspend ? 'Matrícula suspendida en Moodle' : 'Matriculado/activo en Moodle';
                result.moodle_enrollment_id = moodleEnrollmentId;

            } else {
                throw new Error(`Estado de matrícula no reconocido: "${enr.estado}"`);
            }

            result.status = 'success';
            result.message = mensaje;

        } catch (error) {
            console.error('Error sincronizando matrícula:', enr.id, error.message);
            result.status = 'error';
            result.error = error.message;
            if (enr.id) {
                await enrollmentsCtrl.markEnrollmentSyncFailed(enr.id);
                await logSyncError('enrollment', enr.id, error.message, username);
            }
        }

        results.push(result);
    }

    return { results };
}

module.exports = { syncEnrollments };
