const { normalizeCourse, buildCourseNames, cleanSpaces, normalizeEmail, splitNombreCompleto } = require('../../services/normalize');
const enrollmentsCtrl = require('../enrollments/index');

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
            periodo,
            grupo: grupoRaw,
            fecha_inicio,
            fecha_fin
        } = course;
        const grupo = normalizeGrupo(grupoRaw);

        // Se normaliza (Title Case) antes de armar fullname/shortname y de comparar
        // contra lo ya guardado: así el nombre que se ve y el que se manda a Moodle
        // salen limpios, y una diferencia de mayúsculas en lo que manda SICAU no se
        // confunde con un cambio real de profesor/asignatura.
        const { nombre_asignatura, nombre_profesor, departamento, programa } = normalizeCourse(course);
        // Datos de contacto del profesor: se guardan tal cual los manda SICAU
        // (solo limpieza básica), no son un catálogo que necesite Title Case.
        const documento = cleanSpaces(course.documento) || null;
        const celular = cleanSpaces(course.celular) || null;
        const correo_institucional = course.correo_institucional ? normalizeEmail(course.correo_institucional) : null;

        const { fullname, shortname } = buildCourseNames({
            grupo, nombreAsignatura: nombre_asignatura, codigoAsignatura: codigo_asignatura, nombreProfesor: nombre_profesor, periodo,
        });
        const idnumber = `${codigo_asignatura}${periodo}${grupo}`;
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
        let resultado;
        const existing = await data.findCourseSicau(idnumber);
        if (existing.length > 0) {
            const curso = existing[0];
            const cambioProfesor  = (curso.nombre_profesor || null) !== (nombre_profesor || null);
            const cambioAsignatura = (curso.nombre_asignatura || null) !== (nombre_asignatura || null);
            if (cambioProfesor || cambioAsignatura) {
                // Si el curso ya existe en Moodle (moodle_id), no es un curso nuevo,
                // solo cambió su metadata: se marca "novedad" para que Módulo
                // Cursos lo muestre en amarillo con opción de actualizar en Moodle
                // (no se vuelve a duplicar). Si nunca se creó en Moodle, sigue
                // "pendiente": todavía necesita el ciclo completo de duplicado en
                // Sync Cursos, no un simple update de metadata.
                const estadoDestino = curso.moodle_id ? 'novedad' : 'pendiente';
                await data.updateCourseFromSicau(curso.id, {
                    nombre_profesor, fullname, shortname, nombre_asignatura,
                    documento, celular, correo_institucional, estado_sync: estadoDestino
                });
                resultado = { idnumber, status: 'updated_profesor' };
            } else {
                resultado = { idnumber, status: 'exists' };
            }
        } else {
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
                nombre_profesor:   nombre_profesor   || null,
                documento,
                celular,
                correo_institucional,
                fecha_inicio:      fecha_inicio      || null,
                fecha_fin:         fecha_fin         || null,
                periodo:           periodo           || null,
                grupo:             grupo             || null,
                codigo_asignatura: codigo_asignatura || null,
                nombre_asignatura: nombre_asignatura || null,
                templatecourse
            });
            resultado = { idnumber, shortname, status: 'saved' };
        }

        // El profesor llega junto con el curso (no por /sicau/send_users_sicau):
        // se asegura de que exista como usuario en Nexo -creándolo si hace falta,
        // ver ensureDocenteMatriculado- y de que quede matriculado en este curso
        // con rol de profesor (editingteacher en Moodle), en cualquiera de los
        // tres casos de arriba (curso nuevo, actualizado o sin cambios: si el
        // profesor todavía no estaba matriculado, esto lo repara solo).
        resultado.profesor = await ensureDocenteMatriculado({
            nombre_profesor, documento, celular, correo_institucional,
            codigo_asignatura, nombre_asignatura, programa, periodo, grupo
        });

        return resultado;
    }

    // Crea al profesor como usuario si todavía no existe (localizándolo por
    // documento, igual que se hace con estudiantes) y lo matricula en el curso.
    // Solo se piden nombre/documento/correo institucional: son los únicos datos
    // que SICAU manda junto con el curso, y son los únicos que hacen falta para
    // matricular -el resto de columnas de users (teléfono, ciudad, jornada,
    // programa académico, etc.) no aplican a un profesor y quedan vacías,
    // usando los mismos defaults que ya tiene insertUsuarioData-.
    // documento/correo_institucional son obligatorios porque hacen de username/
    // password/idnumber en Moodle (ver database/seeds/fixMoodleExternalDbViews.js);
    // sin ellos no hay forma de crear ni matricular al profesor, así que se
    // omite en silencio (el curso igual se guarda) en vez de fallar todo el lote.
    async function ensureDocenteMatriculado({ nombre_profesor, documento, celular, correo_institucional, codigo_asignatura, nombre_asignatura, programa, periodo, grupo }) {
        if (!nombre_profesor || !documento || !correo_institucional) {
            return { status: 'omitido', error: 'Falta nombre_profesor, documento o correo_institucional' };
        }

        let userid;
        const existentes = await data.findUserByDoc(String(documento));
        if (existentes.length > 0) {
            userid = existentes[0].id;
        } else {
            const { firstname, lastname } = splitNombreCompleto(nombre_profesor);
            const insertado = await data.insertUser({
                username:  correo_institucional,
                firstname,
                lastname,
                email:     correo_institucional,
                password:  String(documento),
                documento,
                celular,
                moodle_id: null,
                sincronizado: false
            });
            userid = insertado[0].id;
        }

        return enrollmentsCtrl.saveEnrollmentConNovedades({
            userid,
            codigo_asignatura,
            nombre_asignatura,
            programa,
            periodo,
            grupo,
            role:   'editingteacher',
            estado: 'Matriculado'
        });
    }

    // ─── MATRÍCULAS ───────────────────────────────────────────────────────────

    // La detección de novedades (traslado por cambio de grupo, cambio de
    // estado sin cambio de grupo) vive en un solo lugar: enrollmentsCtrl.
    // saveEnrollmentConNovedades (api/enrollments/controller.js) — la usa
    // tanto esta ingesta automática de SICAU como la creación manual desde
    // Módulos > Matrículas, para que el comportamiento sea idéntico sin
    // importar de dónde venga la matrícula.
    async function saveSicauMatricula(enr) {
        // 1. Buscar userid por cédula (SICAU manda cédula, no el id interno)
        const userResult = await data.findUserByDoc(String(enr.cedula));
        if (userResult.length === 0) {
            return { cedula: enr.cedula, status: 'error', error: 'Usuario no encontrado' };
        }
        const userid = userResult[0].id;
        const grupo = normalizeGrupo(enr.grupo);
        const moodleRole = ROLE_MAP[enr.role?.toUpperCase()] || 'student';

        const result = await enrollmentsCtrl.saveEnrollmentConNovedades({
            userid,
            codigo_asignatura: enr.codigo_asignatura,
            nombre_asignatura: enr.nombre_asignatura,
            programa:          enr.programa,
            periodo:           enr.periodo,
            grupo,
            role:              moodleRole,
            estado:            enr.estado || null
        });

        return { cedula: enr.cedula, ...result };
    }

    // ─── ENDPOINT UNIFICADO: CURSO + MATRÍCULAS ──────────────────────────────

    // SICAU manda cada matrícula dentro de items[].enrollments con su propia
    // codigo_asignatura/nombre_asignatura/programa/periodo/grupo (el mismo
    // formato que documenta /sicau/send_enrollments_sicau) — no solo
    // {cedula, role, estado} dependiendo del curso padre. Antes esos campos de
    // la matrícula se descartaban siempre y se pisaban con los del curso
    // padre; ahora ganan los de la matrícula si vienen, y solo se completa
    // con los del curso los que falten (para seguir aceptando el envío
    // mínimo {cedula, role, estado} si algún día se usa así).
    async function saveSicauCursoYMatriculas(item) {
        const { course, enrollments } = item;
        const courseResult = await saveSicauCurso(course);

        const enrollmentResults = [];
        for (const enr of (enrollments || [])) {
            const merged = {
                ...enr,
                codigo_asignatura: enr.codigo_asignatura || course.codigo_asignatura,
                nombre_asignatura: enr.nombre_asignatura || course.nombre_asignatura,
                programa:          enr.programa          || course.programa,
                periodo:           enr.periodo           || course.periodo,
                grupo:             enr.grupo             || course.grupo
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
