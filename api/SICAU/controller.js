// ─── MAPEO DE ROLES ───────────────────────────────────────────────────────────
const ROLE_MAP = {
    'ESTUDIANTE': 'student',
    'DOCENTE':    'editingteacher',
    'TUTOR':      'teacher'
};

// SICAU manda el grupo como número plano (ej. "105"), pero el código de curso
// journey siempre debe llevar la "G" al frente (ej. "G105") para que el
// idnumber/codigo_journey quede como FB001020261G105. Si ya viene con G
// (mayúscula o minúscula) no se duplica.
function normalizeGrupo(grupo) {
    if (grupo === null || grupo === undefined) return grupo;
    const g = String(grupo).trim();
    if (!g) return g;
    return /^G/i.test(g) ? `G${g.slice(1)}` : `G${g}`;
}

module.exports = (injectedDB) => {
    let data = injectedDB;
    if (!data) data = require('../../database/postgresql');

    async function saveSicauUsuario(user) {
        const existing = await data.findUserSicau(user.email, user.username);

        if (existing.length > 0) {
            await data.updateUserFromSicau(user);
            return { username: user.username, status: 'updated' };
        } else {
            await data.insertUser({
                username:               user.username,
                firstname:              user.firstname,
                lastname:               user.lastname,
                email:                  user.email,
                password:               user.documento ? String(user.documento) : 'Pascual2024*',
                city:                   user.city                   || 'Medellín',
                country:                user.country                || 'CO',
                documento:              user.documento              || null,
                correo_personal:        user.correo_personal        || null,
                telefono:               user.telefono               || null,
                celular:                user.celular                || null,
                fecha_nacimiento:       user.fecha_nacimiento       || null,
                jornada:                user.jornada                || null,
                departamento_academico: user.departamento_academico || null,
                plan_estudios:          user.plan_estudios          || null,
                moodle_id:              null,
                sincronizado:           false
            });
            return { username: user.username, status: 'saved' };
        }
    }

    // ─── CURSOS ───────────────────────────────────────────────────────────────

    async function saveSicauCurso(course) {
        const {
            codigo_asignatura,
            nombre_asignatura,
            programa,
            departamento,
            periodo,
            grupo: grupoRaw,
            docente,
            fecha_inicio,
            fecha_fin
        } = course;
        const grupo = normalizeGrupo(grupoRaw);

        // Construir campos derivados
        const periodoFormateado = periodo
            ? `${periodo.slice(0, 4)}-${periodo.slice(4)}`
            : '';

        const fullname  = `${grupo} ${nombre_asignatura} (${codigo_asignatura}) - Docente: ${docente} (${periodoFormateado})`;
        const shortname = `${grupo} ${nombre_asignatura} (${codigo_asignatura})(${periodoFormateado})`;
        const idnumber  = `${codigo_asignatura}${periodo}${grupo}`;
        const templatecourse = `SEMILLA-${codigo_asignatura}`;

        // Verificar si ya existe: por idnumber (codigo_asignatura+periodo+grupo),
        // el código journey -único- de "este grupo en este periodo", NO por
        // shortname. El shortname incluye nombre_asignatura, así que si SICAU
        // corrige el nombre de la asignatura (como pasó: mismo grupo/periodo,
        // pero cambió de "Gestión de Inventarios" a "Dibujo Técnico") el
        // shortname cambia y buscar por ahí no lo encuentra: se insertaba como
        // curso nuevo y al sincronizar se duplicaba la semilla otra vez con el
        // mismo idnumber que el curso original, chocando porque el idnumber
        // tiene que ser único en Moodle.
        const existing = await data.findCourseSicau(idnumber);
        if (existing.length > 0) {
            const curso = existing[0];
            const cambioDocente   = (curso.docente || null) !== (docente || null);
            const cambioAsignatura = (curso.nombre_asignatura || null) !== (nombre_asignatura || null);
            if (cambioDocente || cambioAsignatura) {
                // Si el curso ya existe en Moodle (moodle_id), no es un curso nuevo,
                // solo cambió su metadata: se marca "novedad" para que Módulo
                // Cursos lo muestre en amarillo con opción de actualizar en Moodle
                // (no se vuelve a duplicar). Si nunca se creó en Moodle, sigue
                // "pendiente": todavía necesita el ciclo completo de duplicado en
                // Sync Cursos, no un simple update de metadata.
                const estadoDestino = curso.moodle_id ? 'novedad' : 'pendiente';
                await data.updateCourseFromSicau(curso.id, { docente, fullname, shortname, nombre_asignatura, estado_sync: estadoDestino });
                return { idnumber, status: 'updated_docente' };
            }
            return { idnumber, status: 'exists' };
        }

        await data.insertCourse({
            fullname,
            shortname,
            idnumber,
            categoryid:        null,
            summary:           null,
            visible:           true,
            format:            'topics',
            numsections:       10,
            moodle_id:         null,
            seed_course_id:    null,
            departamento:      departamento      || null,
            programa:          programa          || null,
            docente:           docente           || null,
            fecha_inicio:      fecha_inicio      || null,
            fecha_fin:         fecha_fin         || null,
            periodo:           periodo           || null,
            grupo:             grupo             || null,
            codigo_asignatura: codigo_asignatura || null,
            nombre_asignatura: nombre_asignatura || null,
            templatecourse
        });

        return { idnumber, shortname, status: 'saved' };
    }

    // ─── MATRÍCULAS ───────────────────────────────────────────────────────────

    async function saveSicauMatricula(enr) {
        // 1. Buscar userid por cédula
        const userResult = await data.findUserByDoc(String(enr.cedula));
        if (userResult.length === 0) {
            return { cedula: enr.cedula, status: 'error', error: 'Usuario no encontrado' };
        }
        const userid = userResult[0].id;

        // 2. Generar código Journey del curso (sin cédula)
        const grupo = normalizeGrupo(enr.grupo);
        const codigoJourney = `${enr.codigo_asignatura}${enr.periodo}${grupo}`;

        // 3. Buscar courseid por codigo_journey
        const courseResult = await data.findCourseSicau(codigoJourney);
        const courseid = courseResult.length > 0 ? courseResult[0].id : null;

        // 4. Verificar si ya existe la matrícula para ese usuario y curso
        const existing = await data.findEnrollmentByUserAndCourse(userid, codigoJourney);
        if (existing.length > 0) {
            return { cedula: enr.cedula, codigo_journey: codigoJourney, status: 'exists' };
        }

        // 5. Mapear rol y insertar
        const moodleRole = ROLE_MAP[enr.role?.toUpperCase()] || 'student';

        await data.insertEnrollment({
            userid,
            courseid,
            role:                   moodleRole,
            moodle_enrollment_id:   null,
            codigo_asignatura:      enr.codigo_asignatura     || null,
            nombre_asignatura:      enr.nombre_asignatura     || null,
            programa:               enr.programa              || null,
            periodo:                enr.periodo               || null,
            grupo:                  grupo                     || null,
            codigo_journey:         codigoJourney,
            estado:                 enr.estado                || null,
            fecha_creacion_journey: new Date().toISOString().split('T')[0]
        });

        return { cedula: enr.cedula, codigo_journey: codigoJourney, status: 'saved' };
    }

    // ─── ENDPOINT UNIFICADO: CURSO + MATRÍCULAS ──────────────────────────────

    async function saveSicauCursoYMatriculas(item) {
        const { course, enrollments } = item;
        const courseResult = await saveSicauCurso(course);

        const enrollmentResults = [];
        for (const enr of (enrollments || [])) {
            const merged = {
                ...enr,
                codigo_asignatura: course.codigo_asignatura,
                nombre_asignatura: course.nombre_asignatura,
                programa:          course.programa,
                periodo:           course.periodo,
                grupo:             course.grupo
            };
            const result = await saveSicauMatricula(merged);
            enrollmentResults.push(result);
        }

        return { course: courseResult, enrollments: enrollmentResults };
    }

    return {
        saveSicauUsuario,
        saveSicauCurso,
        saveSicauMatricula,
        saveSicauCursoYMatriculas
    };
};
