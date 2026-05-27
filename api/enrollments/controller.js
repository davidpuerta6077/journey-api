module.exports = (injectedDB) => {
    let data = injectedDB;
    if (!data) data = require('../../database/postgresql');

    function list(tabla) {
        return data.listAll(tabla);
    }

    async function addElement(enrollmentData) {
        return data.insertEnrollment(enrollmentData);
    }

    async function updateElement(enrollmentData) {
        return data.updateEnrollment(enrollmentData);
    }

    // ─── SYNC ─────────────────────────────────────────────────────────────────

    async function listEnrollmentsForSync() {
        return data.getEnrollmentsForSync();
    }

    async function updateEnrollmentMoodleId(id, moodleEnrollmentId) {
        return data.setEnrollmentMoodleId(id, moodleEnrollmentId);
    }

    async function markEnrollmentAsSynchronized(id) {
        return data.updateEnrollmentSyncStatus(id, true);
    }

    // ─── SICAU ────────────────────────────────────────────────────────────────

    async function saveSicauMatricula(enr) {
        // 1. Buscar userid por cédula
        const userResult = await data.findUserByDoc(String(enr.cedula));
        if (userResult.length === 0) {
            return { cedula: enr.cedula, status: 'error', error: 'Usuario no encontrado' };
        }
        const userid = userResult[0].id;

        // 2. Generar código Journey del curso (sin cédula)
        const codigoJourney = `${enr.codigo_asignatura}${enr.periodo}${enr.grupo}`;

        // 3. Buscar courseid por codigo_journey
        const courseResult = await data.findCourseSicau(codigoJourney);
        const courseid = courseResult.length > 0 ? courseResult[0].id : null;

        // 4. Verificar si ya existe la matrícula para ese usuario y curso
        const existing = await data.findEnrollmentByUserAndCourse(userid, codigoJourney);
        if (existing.length > 0) {
            return { cedula: enr.cedula, codigo_journey: codigoJourney, status: 'exists' };
        }

        // 5. Insertar
        await data.insertEnrollment({
            userid,
            courseid,
            role:                  enr.role                  || 'student',
            moodle_enrollment_id:  null,
            codigo_asignatura:     enr.codigo_asignatura     || null,
            nombre_asignatura:     enr.nombre_asignatura     || null,
            programa:              enr.programa              || null,
            periodo:               enr.periodo               || null,
            grupo:                 enr.grupo                 || null,
            codigo_journey:        codigoJourney,
            estado:                enr.estado                || null,
            fecha_creacion_journey: new Date().toISOString().split('T')[0]
        });

        return { cedula: enr.cedula, codigo_journey: codigoJourney, status: 'saved' };
    }

    async function listEnrollmentsWithUsers() {
        return data.listAllEnrollmentsWithUsers();
    }

    return {
        list,
        addElement,
        updateElement,
        listEnrollmentsForSync,
        updateEnrollmentMoodleId,
        markEnrollmentAsSynchronized,
        saveSicauMatricula,
        listEnrollmentsWithUsers
    };
};