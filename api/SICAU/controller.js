const { normalizeCourse, buildCourseNames, cleanSpaces, normalizeEmail, normalizeUser, splitNombreCompleto, normalizeEstado } = require('../../services/normalize');
const { getDominioCorreoPermitido, emailTieneDominio } = require('../../services/emailDomain');
const enrollmentsCtrl = require('../enrollments/index');

// ─── MAPEO DE ROLES ───────────────────────────────────────────────────────────
const ROLE_MAP = {
    'ESTUDIANTE': 'student',
    'DOCENTE':    'editingteacher',
    'TUTOR':      'teacher'
};

// Campos (no-correo) que se comparan contra lo que ya había en Nexo para armar
// la novedad informativa de saveSicauUsuario (ver ahí). El correo se trata
// aparte porque es el username en Moodle y no se pisa solo (ver CAMPOS_NOVEDAD).
const CAMPOS_NOVEDAD = [
    'firstname', 'lastname', 'correo_personal', 'telefono', 'celular',
    'fecha_nacimiento', 'jornada', 'departamento_academico', 'plan_estudios', 'city', 'estado'
];

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

    // Un usuario = una persona: se localiza por documento (es el username/
    // idnumber en Moodle) y solo si SICAU no lo manda se cae al email. Si el
    // documento es nuevo pero el email ya es de otra persona, no se crea un
    // segundo usuario con el mismo email: se reporta como error de esa fila.
    async function saveSicauUsuario(user) {
        const existing = user.documento
            ? await data.findUserByDoc(String(user.documento))
            : await data.findUserSicau(user.email, user.username);

        if (existing.length > 0) {
            // Antes de pisar nada: comparar contra lo que ya había para detectar
            // la novedad. El correo (username en Moodle) nunca se pisa solo -se
            // deja en correo_pendiente esperando una decisión humana (actualizar
            // o crear un usuario nuevo, ver api/users)-; el resto de campos sigue
            // aplicándose automático como siempre, solo que ahora queda un
            // registro de qué cambió (novedad_datos) para que se vea en Sync >
            // Usuarios.
            const before = (await data.getUserCompareFields(existing[0].id))[0] || {};
            const incomingEmail = user.email ? normalizeEmail(user.email) : null;
            if (incomingEmail && before.email && incomingEmail !== before.email) {
                await data.setUserCorreoPendiente(existing[0].id, incomingEmail);
            }
            const normalizado = normalizeUser(user);
            // fecha_nacimiento vuelve de Postgres como Date (columna DATE), no como
            // string: sin esto se comparaba Date !== "YYYY-MM-DD" y SIEMPRE marcaba
            // novedad aunque la fecha fuera la misma.
            const toComparable = (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : v);
            const cambios = CAMPOS_NOVEDAD
                .filter(campo => user[campo] !== undefined)
                .map(campo => ({ campo, anterior: toComparable(before[campo]) ?? null, actual: toComparable(normalizado[campo] ?? user[campo]) ?? null }))
                .filter(c => c.anterior !== c.actual);
            if (cambios.length > 0) await data.setUserNovedadDatos(existing[0].id, cambios);

            await data.updateUserFromSicau({ ...user, id: existing[0].id });
            if (user.novedad) await registrarNovedadUsuario(user, 'Usuario actualizado');
            return { username: user.username, status: 'updated' };
        }
        if (user.documento) {
            const emailTomado = await data.findUserSicau(user.email, user.username);
            if (emailTomado.length > 0) {
                const error = `El email ${user.email} ya pertenece a otro usuario`;
                if (user.novedad) await registrarNovedadUsuario(user, error);
                return { username: user.username, status: 'error', error };
            }
        }
        const dominioCorreo = await getDominioCorreoPermitido(data);
        if (!emailTieneDominio(user.email, dominioCorreo)) {
            const error = `El email ${user.email} no es del dominio institucional (@${dominioCorreo}), no se crea el usuario`;
            if (user.novedad) await registrarNovedadUsuario(user, error);
            return { username: user.username, status: 'error', error };
        }
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
            estado:                 user.estado                 || null,
            moodle_id:              null,
            sincronizado:           false
        });
        if (user.novedad) await registrarNovedadUsuario(user, 'Usuario creado');
        return { username: user.username, status: 'saved' };
    }

    // SICAU manda su propia novedad ya calculada para el usuario (NUEVO,
    // CAMBIO_DE_DATOS...), igual que hace con cursos/matrículas (ver
    // registrarNovedadSicau). Nivel 'usuario' para que Sync > Novedades la
    // distinga de las de curso/matrícula; se ubica por documento (= cédula).
    async function registrarNovedadUsuario(user, resultado) {
        await registrarNovedadSicau({
            nivel: 'usuario',
            tipo: user.novedad.tipo,
            motivo: user.novedad.motivo || null,
            cedula: user.documento ? String(user.documento) : null,
            cambios: user.novedad.cambios || [],
            usuario_sicau: user.usuario || null,
            resultado,
        });
    }

    // ─── CURSOS ───────────────────────────────────────────────────────────────

    async function saveSicauCurso(course, usuarioOverride) {
        const usuario = usuarioOverride || course.usuario || null;
        // RETIRO puede llegar tanto por el endpoint unificado (curso+matrículas)
        // como por /send_courses_sicau a secas (p.ej. "Gestión de grupos
        // virtuales" desmarca que un curso ya no lo necesita y manda solo el
        // curso, sin enrollments): se revisa aquí, no en saveSicauCursoYMatriculas,
        // para que ambos caminos lo manejen igual en vez de que el segundo caiga
        // en el flujo normal de curso y falle por falta de datos de profesor.
        if (course.novedad?.tipo === 'RETIRO') {
            return retirarCursoSicau(course, usuario);
        }

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
        // Las fechas vuelven de Postgres como Date (columna DATE, igual que
        // fecha_nacimiento en usuarios): se normalizan a "YYYY-MM-DD" antes de
        // comparar para no marcar novedad por un cambio de tipo que no es real.
        const toFecha = (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : v) || null;
        const fechaInicioNueva = fecha_inicio || null;
        const fechaFinNueva = fecha_fin || null;

        if (existing.length > 0) {
            const curso = existing[0];
            const cambioProfesor  = (curso.nombre_profesor || null) !== (nombre_profesor || null);
            const cambioAsignatura = (curso.nombre_asignatura || null) !== (nombre_asignatura || null);
            const cambioFechas = toFecha(curso.fecha_inicio) !== fechaInicioNueva || toFecha(curso.fecha_fin) !== fechaFinNueva;
            if (cambioProfesor || cambioAsignatura || cambioFechas) {
                // Si el curso ya existe en Moodle (moodle_id), no es un curso nuevo,
                // solo cambió su metadata: se marca "novedad" para que Módulo
                // Cursos lo muestre en amarillo con opción de actualizar en Moodle
                // (no se vuelve a duplicar). Si nunca se creó en Moodle, sigue
                // "pendiente": todavía necesita el ciclo completo de duplicado en
                // Sync Cursos, no un simple update de metadata.
                const estadoDestino = curso.moodle_id ? 'novedad' : 'pendiente';
                // Mismo patrón que users.novedad_datos (ver CAMPOS_NOVEDAD arriba):
                // se guarda el último cambio en la fila del curso para que Módulo
                // Cursos lo muestre al expandir la fila, igual que ya se ve en
                // Sync > Usuarios, sin tener que ir a buscarlo a Sync > Novedades.
                const cambiosDatos = [];
                if (cambioProfesor) cambiosDatos.push({ campo: 'nombre_profesor', anterior: curso.nombre_profesor || null, actual: nombre_profesor || null });
                if (cambioFechas) cambiosDatos.push(
                    ...[
                        { campo: 'fecha_inicio', anterior: toFecha(curso.fecha_inicio), actual: fechaInicioNueva },
                        { campo: 'fecha_fin', anterior: toFecha(curso.fecha_fin), actual: fechaFinNueva },
                    ].filter(c => c.anterior !== c.actual)
                );
                await data.updateCourseFromSicau(curso.id, {
                    nombre_profesor, fullname, shortname, nombre_asignatura,
                    documento, celular, correo_institucional,
                    fecha_inicio: fechaInicioNueva, fecha_fin: fechaFinNueva,
                    estado_sync: estadoDestino,
                    novedad_datos: cambiosDatos
                });
                resultado = { idnumber, status: 'updated_profesor' };

                // Igual que con matrículas: se deja constancia en sicau_novedades
                // (Sync > Novedades) de qué cambió, no solo se marca el curso en
                // amarillo en Módulo Cursos. Antes esto no se registraba y un
                // cambio de profesor o de fechas quedaba mudo para quien revisa
                // novedades (solo se veía si entraban a Módulo Cursos).
                if (cambioProfesor) {
                    await registrarNovedadSicau({
                        nivel: 'curso',
                        tipo: 'CAMBIO_DE_PROFESOR',
                        motivo: null,
                        codigo_journey: idnumber,
                        codigo_asignatura,
                        nombre_asignatura,
                        periodo,
                        grupo,
                        cedula: null,
                        cambios: [{ campo: 'nombre_profesor', anterior: curso.nombre_profesor || null, actual: nombre_profesor || null }],
                        usuario_sicau: usuario,
                        resultado: 'Curso actualizado',
                    });
                }
                if (cambioFechas) {
                    await registrarNovedadSicau({
                        nivel: 'curso',
                        tipo: 'CAMBIO_DE_FECHAS',
                        motivo: null,
                        codigo_journey: idnumber,
                        codigo_asignatura,
                        nombre_asignatura,
                        periodo,
                        grupo,
                        cedula: null,
                        cambios: [
                            { campo: 'fecha_inicio', anterior: toFecha(curso.fecha_inicio), actual: fechaInicioNueva },
                            { campo: 'fecha_fin', anterior: toFecha(curso.fecha_fin), actual: fechaFinNueva },
                        ].filter(c => c.anterior !== c.actual),
                        usuario_sicau: usuario,
                        resultado: 'Curso actualizado',
                    });
                }
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
            // Documento nuevo con un correo que ya es de otra persona: no se
            // crea un segundo usuario con el mismo email (ver saveSicauUsuario).
            const emailTomado = await data.findUserSicau(correo_institucional, correo_institucional);
            if (emailTomado.length > 0) {
                return { status: 'error', error: `El email ${correo_institucional} ya pertenece a otro usuario` };
            }
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
    // ─── NOVEDADES REPORTADAS POR SICAU ──────────────────────────────────────
    // SICAU manda su propia novedad ya calculada (CAMBIO_DE_GRUPO,
    // CAMBIO_DE_ESTADO, RETIRO...). La lógica de Nexo sigue por `estado`; esto
    // solo la guarda en sicau_novedades para mostrarla en Sync > Novedades.
    // Best-effort: si falla el registro, la ingesta no se cae.
    async function registrarNovedadSicau(row) {
        try {
            await data.insertSicauNovedad(row);
        } catch (err) {
            console.error('No se pudo registrar la novedad de SICAU:', err.message);
        }
    }

    // RETIRO de curso (p.ej. desde "Gestión de grupos virtuales" desmarcan que
    // requiere curso virtual): se desmatriculan sus estudiantes activos por la
    // misma vía que "Desmatricular" en Nexo (estado 'Desmatriculado', la fila
    // sale de moodle_enrol). El curso no se crea, actualiza ni oculta.
    async function retirarCursoSicau(course, usuario) {
        const codigoJourney = `${course.codigo_asignatura}${course.periodo}${normalizeGrupo(course.grupo)}`;
        const matriculas = await data.findEnrollmentsByCodigoJourney(codigoJourney);
        const activas = matriculas.filter(m => normalizeEstado(m.estado) === 'Matriculado');
        for (const m of activas) {
            await data.updateEnrollmentEstado(m.id, 'Desmatriculado');
            await data.updateEnrollmentEstadoSync(m.id, 'pendiente');
            await data.updateEnrollmentSyncStatus(m.id, false);
        }
        await registrarNovedadSicau({
            nivel: 'curso',
            tipo: course.novedad.tipo,
            motivo: course.novedad.motivo || null,
            codigo_journey: codigoJourney,
            codigo_asignatura: course.codigo_asignatura,
            nombre_asignatura: course.nombre_asignatura || null,
            periodo: course.periodo,
            grupo: normalizeGrupo(course.grupo),
            cedula: null,
            cambios: course.novedad.cambios || [],
            usuario_sicau: usuario || null,
            resultado: `${activas.length} matrícula(s) desmatriculada(s)`,
        });
        return { codigo_journey: codigoJourney, status: 'retiro', desmatriculadas: activas.length };
    }

    async function saveSicauMatricula(enr, usuario) {
        const grupo = normalizeGrupo(enr.grupo);
        if (enr.novedad) {
            await registrarNovedadSicau({
                nivel: 'matricula',
                tipo: enr.novedad.tipo,
                motivo: enr.novedad.motivo || null,
                codigo_journey: `${enr.codigo_asignatura}${enr.periodo}${grupo}`,
                codigo_asignatura: enr.codigo_asignatura,
                nombre_asignatura: enr.nombre_asignatura || null,
                periodo: enr.periodo,
                grupo,
                cedula: String(enr.cedula),
                cambios: enr.novedad.cambios || [],
                usuario_sicau: usuario || enr.usuario || null,
                resultado: null,
            });
        }

        // 1. Buscar userid por cédula (SICAU manda cédula, no el id interno)
        const userResult = await data.findUserByDoc(String(enr.cedula));
        if (userResult.length === 0) {
            return { cedula: enr.cedula, status: 'error', error: 'Usuario no encontrado' };
        }
        const userid = userResult[0].id;
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
    async function saveSicauCursoYMatriculas(item, usuario) {
        const { course, enrollments } = item;
        usuario = usuario || course?.usuario || item.usuario;
        const courseResult = await saveSicauCurso(course, usuario);
        if (courseResult.status === 'retiro') {
            return { course: courseResult, enrollments: [] };
        }

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
            const result = await saveSicauMatricula(merged, usuario);
            // SICAU manda la novedad ya calculada de su lado (p.ej. CAMBIO_DE_GRUPO
            // con el detalle de campos que cambiaron); journey sigue detectando sus
            // propias novedades en saveEnrollmentConNovedades, así que esto no altera
            // esa lógica: solo se conserva en la respuesta/log como referencia de lo
            // que SICAU reportó.
            enrollmentResults.push(enr.novedad ? { ...result, novedad: enr.novedad } : result);
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
