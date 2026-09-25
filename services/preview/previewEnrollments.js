const enrollmentsCtrl = require('../../api/enrollments/index');
const { moodleRequest } = require('../moodleService');

// Antes esto hacía hasta 2 llamadas HTTP a Moodle POR CADA matrícula, una
// detrás de otra (con 100 matrículas: hasta 200 llamadas secuenciales — la
// causa principal de que Sync Matrículas/Novedades tardaran tanto en cargar).
// Ahora:
//   1. Una sola llamada por lotes para resolver TODOS los usuarios de Moodle
//      (core_user_get_users_by_field ya acepta varios values[] en una sola
//      petición — mismo patrón que ya usaba resolveMoodleUsersByDocumento).
//   2. Una llamada de "cursos del usuario" por USUARIO ÚNICO, no por fila (un
//      estudiante con 5 matrículas antes generaba 5 llamadas idénticas), y
//      todas en paralelo con Promise.all en vez de esperar una por una.
async function previewEnrollments() {
    const enrollments = await enrollmentsCtrl.listEnrollmentsForSync();

    const uniqueUsernames = [...new Set(enrollments.map(e => e.username).filter(Boolean))];
    const moodleUsersByUsername = {};
    let userLookupFailed = false;

    if (uniqueUsernames.length > 0) {
        const params = { field: 'username' };
        uniqueUsernames.forEach((u, i) => { params[`values[${i}]`] = u; });
        const result = await moodleRequest('core_user_get_users_by_field', params);
        if (Array.isArray(result)) {
            result.forEach(u => { moodleUsersByUsername[u.username] = u; });
        } else {
            // moodleRequest ya atrapa errores de red y devuelve null en vez de
            // lanzar — si pasó eso, no hay forma de resolver usuarios por
            // webservice esta vez; cada fila cae a su respaldo local abajo.
            userLookupFailed = true;
        }
    }

    // Solo hace falta consultar los cursos de un usuario si YA está marcado
    // sincronizado localmente (mismo criterio que antes).
    const moodleUserIdsToCheck = [...new Set(
        enrollments
            .filter(e => e.sincronizado && moodleUsersByUsername[e.username])
            .map(e => moodleUsersByUsername[e.username].id)
    )];

    const coursesByMoodleUserId = {};
    await Promise.all(moodleUserIdsToCheck.map(async (userid) => {
        const courses = await moodleRequest('core_enrol_get_users_courses', { userid });
        coursesByMoodleUserId[userid] = Array.isArray(courses) ? courses : null;
    }));

    return enrollments.map(enr => {
        const moodleUser = moodleUsersByUsername[enr.username] || null;
        const userExistsInMoodle = userLookupFailed ? !!enr.user_moodle_id : !!moodleUser;

        let inMoodle;
        if (userExistsInMoodle && enr.sincronizado) {
            const courses = moodleUser ? coursesByMoodleUserId[moodleUser.id] : undefined;
            inMoodle = Array.isArray(courses)
                ? courses.some(c => c.idnumber === enr.codigo_journey)
                : !!enr.moodle_enrollment_id; // no se pudo confirmar por webservice: usar el respaldo local
        } else {
            inMoodle = false;
        }

        return {
            ...enr,
            studentId:   enr.userid,
            courseId:    enr.courseid,
            userExistsInMoodle,
            _syncStatus: { inDB: true, inMoodle }
        };
    });
}

module.exports = { previewEnrollments };
