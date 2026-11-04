// Asignia: programación académica del semestre. El líder (con sesión, permiso
// asignia_manage) carga el Excel y gestiona postulaciones; el profesor (sin
// sesión) se identifica con documento + correo institucional para aceptar o
// rechazar sus cursos asignados y postularse a cursos vacíos.
const { leerExcel, leerProfesores } = require('./parser');

const SUBMODULE = 'asignia_manage';
const DOMINIO = '@pascualbravo.edu.co';
const MAX_IDS = 200;

// Campos que vienen del Excel y se comparan para saber si una fila cambió.
const CAMPOS = ['nivel', 'curso', 'creditos', 'horas_semana', 'espacio', 'horario',
    'profesor_nombre', 'profesor_documento', 'profesor_correo', 'vinculacion', 'verificacion'];
const CAMPOS_PROFESOR = ['profesor_nombre', 'profesor_documento', 'profesor_correo', 'vinculacion'];

function httpError(message, status) {
    const err = new Error(message);
    err.status = status;
    return err;
}

const clave = (f) => [f.sede, f.programa, f.plan, f.codigo, f.grupo, f.agrupamiento, f.jornada].join('|');
// jsonb no conserva el orden de las claves: el horario se compara por valores.
const comparable = (campo, v) => (campo === 'horario'
    ? JSON.stringify((v || []).map((h) => [h.dia, h.hora, h.aula]))
    : String(v ?? ''));
const mismoNombre =(a, b) => a.trim().toLowerCase() === b.trim().toLowerCase();

// Decide qué hacer con cada fila del archivo frente a lo que ya está en BD para
// ese periodo, sin perder el trabajo de verificación hecho:
//  - mismo profesor que antes: conserva el estado (aceptado/rechazado/asignado);
//  - el archivo no trae profesor pero el curso ya fue aceptado por postulación
//    o tiene postulaciones en curso: conserva profesor y estado;
//  - en otro caso el estado sale del archivo: "asignado" si trae profesor, si no "vacio".
// Las filas que están en BD pero no en el archivo no se tocan.
function planCarga(existentes, filas) {
    const porClave = new Map(existentes.map((e) => [clave(e), e]));
    const vistas = new Set();
    const inserts = [];
    const updates = [];
    let sinCambios = 0;
    let duplicadas = 0;

    for (const f of filas) {
        const k = clave(f);
        if (vistas.has(k)) { duplicadas++; continue; }
        vistas.add(k);

        const e = porClave.get(k);
        const estadoArchivo = f.profesor_nombre ? 'asignado' : 'vacio';
        if (!e) { inserts.push({ ...f, verificacion: estadoArchivo }); continue; }

        const conservarProfesor = !f.profesor_nombre && ['aceptado', 'postulado'].includes(e.verificacion);
        const mismoProfesor = Boolean(f.profesor_nombre) && Boolean(e.profesor_nombre) && (f.profesor_documento
            ? f.profesor_documento === e.profesor_documento
            : !e.profesor_documento && mismoNombre(f.profesor_nombre, e.profesor_nombre));

        const nueva = { ...f, id: e.id, reset: false };
        if (conservarProfesor) {
            for (const c of CAMPOS_PROFESOR) nueva[c] = e[c];
            nueva.verificacion = e.verificacion;
        } else if (mismoProfesor) {
            nueva.verificacion = e.verificacion;
        } else {
            nueva.verificacion = estadoArchivo;
            nueva.reset = true;
        }

        const cambio = CAMPOS.some((c) => comparable(c, nueva[c]) !== comparable(c, e[c]));
        if (cambio) updates.push(nueva); else sinCambios++;
    }
    const noEnArchivo = existentes.filter((e) => !vistas.has(clave(e))).length;
    return { inserts, updates, sinCambios, duplicadas, noEnArchivo };
}

function periodoValido(v) {
    const s = String(v ?? '').trim();
    if (!s) throw httpError('Indica el periodo académico de la programación (p. ej. 2027-1)', 400);
    if (s.length > 20) throw httpError('El periodo no puede pasar de 20 caracteres', 400);
    return s;
}

function idValido(v) {
    const n = Number(v);
    if (!Number.isInteger(n) || n <= 0) throw httpError('No encontrado', 404);
    return n;
}

function idsValidos(v) {
    if (!Array.isArray(v) || !v.length) throw httpError('Selecciona al menos un curso', 400);
    if (v.length > MAX_IDS) throw httpError(`No puedes enviar más de ${MAX_IDS} cursos a la vez`, 400);
    const ids = [...new Set(v.map(Number))];
    if (ids.some((n) => !Number.isInteger(n) || n <= 0)) throw httpError('Cursos inválidos', 400);
    return ids;
}

// Identidad del profesor en la pantalla pública: documento + correo institucional.
function identidad(body = {}) {
    const documento = String(body.documento ?? '').replace(/\D/g, '');
    const correo = String(body.correo ?? '').trim().toLowerCase();
    if (documento.length < 5 || documento.length > 15) throw httpError('Escribe tu número de documento sin puntos ni espacios', 400);
    if (!correo.endsWith(DOMINIO) || correo.length <= DOMINIO.length) {
        throw httpError(`Escribe tu correo institucional (termina en ${DOMINIO})`, 400);
    }
    return { documento, correo };
}

const resumenCurso = (c) => ({ codigo: c.codigo, curso: c.curso, grupo: c.grupo });

module.exports = function createController(data) {
    const db = data.asignia;

    // Auditoría de acciones públicas: no pasan por saveLog porque no hay sesión;
    // el usuario del log es el correo con el que se identificó el profesor.
    const log = (correo, descripcion, detalle) =>
        data.insertLog('post', descripcion, correo, SUBMODULE, null, detalle).catch(() => {});

    async function periodoActual() {
        return db.getPeriodoActual();
    }

    // ── Líder ──

    async function cargar(filePath, body = {}) {
        if (!filePath) throw httpError('Adjunta el archivo de programación (.xlsx)', 400);
        const { hoja, filas, omitidas } = await leerExcel(filePath);
        if (!filas.length) throw httpError('El archivo no tiene cursos para cargar', 400);

        // Si no lo indican, el periodo más frecuente en el archivo.
        let periodo = String(body.periodo ?? '').trim();
        if (!periodo) {
            const conteo = {};
            for (const f of filas) if (f.periodo) conteo[f.periodo] = (conteo[f.periodo] || 0) + 1;
            periodo = Object.entries(conteo).sort((a, b) => b[1] - a[1])[0]?.[0] || '';
        }
        periodo = periodoValido(periodo);

        const existentes = await db.listCursos(periodo);
        const plan = planCarga(existentes, filas);
        if (plan.inserts.length) await db.insertCursos(periodo, plan.inserts);
        if (plan.updates.length) await db.updateCursos(plan.updates);
        await db.descartarPostulacionesCerradas();

        return {
            periodo,
            hoja,
            total: filas.length,
            nuevos: plan.inserts.length,
            actualizados: plan.updates.length,
            sinCambios: plan.sinCambios,
            omitidas: omitidas + plan.duplicadas,
            noEnArchivo: plan.noEnArchivo,
            sinDocumento: filas.filter((f) => f.profesor_nombre && (!f.profesor_documento || !f.profesor_correo)).length,
        };
    }

    async function listarCursos(periodoQuery) {
        const periodos = await db.listPeriodos();
        const periodo = String(periodoQuery ?? '').trim() || periodos[0]?.periodo || null;
        const cursos = periodo ? await db.listCursos(periodo) : [];
        return { periodo, periodos, cursos };
    }

    async function listarPostulaciones(cursoId) {
        const curso = await db.getCurso(idValido(cursoId));
        if (!curso) throw httpError('No encontrado', 404);
        return { curso, postulaciones: await db.listPostulaciones(curso.id) };
    }

    async function aprobarPostulacion(postulacionId) {
        const p = await db.getPostulacion(idValido(postulacionId));
        if (!p) throw httpError('No encontrado', 404);
        const curso = await db.aprobarPostulacion(p.id);
        if (!curso) throw httpError('La postulación ya no está pendiente o el curso ya tiene profesor', 409);
        return { postulacion: p, curso };
    }

    async function cargarProfesores(filePath) {
        if (!filePath) throw httpError('Adjunta el archivo de profesores (.xlsx)', 400);
        const { hoja, filas, omitidas } = await leerProfesores(filePath);
        if (!filas.length) throw httpError('El archivo no tiene profesores con documento, nombre y correo', 400);
        const rows = await db.upsertProfesores(filas);
        const nuevos = rows.filter((r) => r.nuevo).length;
        return { hoja, total: filas.length, nuevos, actualizados: filas.length - nuevos, omitidas };
    }

    async function listarProfesores() {
        return db.listProfesores();
    }

    async function liberarCurso(cursoId) {
        const curso = await db.liberarCurso(idValido(cursoId));
        if (!curso) throw httpError('No encontrado', 404);
        return curso;
    }

    // ── Profesor (público) ──

    // Solo entra quien está en la base de profesores o en la programación.
    async function identificar(body) {
        const id = identidad(body);
        if (!(await db.profesorConocido(id.documento, id.correo))) {
            throw httpError('No encontramos un profesor con ese documento y correo. Si eres profesor de la institución, pide al líder que te registre en Asignia.', 404);
        }
        return id;
    }

    async function consultar(body) {
        const { documento, correo } = await identificar(body);
        const periodo = await periodoActual();
        if (!periodo) return { periodo: null, nombre: null, asignados: [], postulaciones: [] };
        const [asignados, postulaciones, nombre] = await Promise.all([
            db.cursosProfesor(periodo, documento, correo),
            db.postulacionesProfesor(periodo, documento, correo),
            db.getNombreProfesor(documento, correo),
        ]);
        return { periodo, nombre, asignados, postulaciones };
    }

    async function responder(body, accion) {
        const { documento, correo } = identidad(body);
        const ids = idsValidos(body.ids);
        const motivo = accion === 'rechazar' ? String(body.motivo ?? '').trim().slice(0, 500) || null : null;
        const estado = accion === 'aceptar' ? 'aceptado' : 'rechazado';
        const rows = await db.responderAsignacion(ids, documento, correo, estado, motivo);
        if (!rows.length) throw httpError('Esos cursos ya no están pendientes de tu respuesta', 409);
        const verbo = accion === 'aceptar' ? 'aceptó' : 'rechazó';
        log(correo, `Profesor ${verbo} ${rows.length} curso(s) asignado(s) en Asignia`,
            rows.map((r) => ({ profesor: r.profesor_nombre, documento, ...resumenCurso(r), estado, ...(motivo ? { motivo } : {}) })));
        return { actualizados: rows.length, estado };
    }

    async function disponibles(body) {
        const { documento } = await identificar(body);
        const periodo = await periodoActual();
        return { periodo, cursos: periodo ? await db.listDisponibles(periodo, documento) : [] };
    }

    async function postular(body) {
        const { documento, correo } = await identificar(body);
        const ids = idsValidos(body.ids);
        const periodo = await periodoActual();
        if (!periodo) throw httpError('No hay programación cargada', 409);
        const nombre = (await db.getNombreProfesor(documento, correo))
            || String(body.nombre ?? '').replace(/\s+/g, ' ').trim().slice(0, 150);
        if (!nombre) throw httpError('Escribe tu nombre completo para postularte', 400);
        const rows = await db.postular(periodo, ids, documento, correo, nombre);
        if (!rows.length) throw httpError('Ya te postulaste a esos cursos o ya no están disponibles', 409);
        log(correo, `Profesor se postuló a ${rows.length} curso(s) en Asignia`,
            rows.map((r) => ({ profesor: nombre, documento, ...resumenCurso(r) })));
        return { postulados: rows.length };
    }

    return {
        cargar, listarCursos, listarPostulaciones, aprobarPostulacion, liberarCurso,
        cargarProfesores, listarProfesores,
        consultar, responder, disponibles, postular,
    };
};

module.exports.planCarga = planCarga;
module.exports.SUBMODULE = SUBMODULE;
