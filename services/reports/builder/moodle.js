const queries = require('../../../database/querysets');
const { moodleUserUrl } = require('../util');

// Columnas de Moodle del constructor (m_*). Todo por lote: unas pocas consultas
// con IN (...) para todas las filas, nunca una por estudiante ni por curso.
// Fuente 1: BD MySQL de Moodle (accesos, matrícula, nota, avance, entregas).
// Fuente 2 (si la BD no responde): REST, que solo da accesos y matrícula.
// El cruce Nexo -> Moodle es por username y, de respaldo, documento = idnumber
// (moodle_auth_users); cursos por idnumber y, de respaldo, shortname.

const LOTE = 500;
const AVISO_REST = 'No hubo conexión directa a la base de datos de Moodle: accesos y matrículas salieron de la API web; calificación, avance y entregas vencidas quedaron vacíos.';
const AVISO_SIN_MOODLE = 'Moodle no respondió: las columnas de Moodle quedaron vacías.';

const low = (v) => String(v ?? '').trim().toLowerCase();
const distintos = (rows, key) => [...new Set(rows.map((r) => low(r[key])).filter(Boolean))];
const lotes = (lista) => {
    const out = [];
    for (let i = 0; i < lista.length; i += LOTE) out.push(lista.slice(i, i + LOTE));
    return out.length ? out : [[]];
};
// mysql2 no acepta IN () vacío.
const noVacio = (l) => (l.length ? l : ['']);
const par = (u, c) => `${u}:${c}`;

const fecha = (ts) => (ts ? new Date(ts * 1000).toLocaleString('sv-SE', { timeZone: 'America/Bogota' }).slice(0, 16) : null);
const dias = (ts) => (ts ? Math.floor((Date.now() / 1000 - ts) / 86400) : null);

function mapaUsuarios(lista) {
    const porUsername = new Map(), porIdnumber = new Map();
    for (const u of lista) {
        if (u.username) porUsername.set(low(u.username), u);
        if (u.idnumber) porIdnumber.set(low(u.idnumber), u);
    }
    return { porUsername, porIdnumber };
}

async function desdeBD(rows, conCurso, mysql) {
    const run = async (q) => mysql(q.text, q.values);
    const usernames = distintos(rows, '_username'), documentos = distintos(rows, '_documento');
    const usuarios = [];
    const n = Math.max(usernames.length, documentos.length);
    for (let i = 0; i < Math.max(n, 1); i += LOTE) {
        usuarios.push(...await run(queries.reportBuilderMoodle.usuarios(noVacio(usernames.slice(i, i + LOTE)), noVacio(documentos.slice(i, i + LOTE)))));
    }
    const d = { ...mapaUsuarios(usuarios), completo: true };
    if (!conCurso) return d;

    const cursos = await run(queries.reportBuilderMoodle.cursos(noVacio(distintos(rows, '_curso_idnumber')), noVacio(distintos(rows, '_curso_shortname'))));
    d.cursoPorIdnumber = new Map(cursos.filter((c) => c.idnumber).map((c) => [low(c.idnumber), c.id]));
    d.cursoPorShortname = new Map(cursos.filter((c) => c.shortname).map((c) => [low(c.shortname), c.id]));
    const ids = cursos.map((c) => c.id);
    d.matriculas = new Set(); d.accesoCurso = new Map(); d.notas = new Map();
    d.totales = new Map(); d.hechas = new Map(); d.tareas = new Map(); d.entregadas = new Set();
    if (!ids.length) return d;

    for (const lote of lotes(ids)) {
        for (const r of await run(queries.reportBuilderMoodle.matriculas(lote))) d.matriculas.add(par(r.userid, r.courseid));
        for (const r of await run(queries.reportBuilderMoodle.accesosCurso(lote))) d.accesoCurso.set(par(r.userid, r.courseid), Number(r.timeaccess));
        for (const r of await run(queries.reportBuilderMoodle.notas(lote))) d.notas.set(par(r.userid, r.courseid), r);
        for (const r of await run(queries.reportBuilderMoodle.actividadesConFinalizacion(lote))) d.totales.set(Number(r.course), Number(r.total));
        for (const r of await run(queries.reportBuilderMoodle.actividadesCompletadas(lote))) d.hechas.set(par(r.userid, r.course), Number(r.hechas));
        for (const r of await run(queries.reportBuilderMoodle.tareasVencidas(lote))) {
            const c = Number(r.course);
            d.tareas.set(c, [...(d.tareas.get(c) || []), r.id]);
        }
    }
    const tareaIds = [...d.tareas.values()].flat();
    for (const lote of tareaIds.length ? lotes(tareaIds) : []) {
        for (const r of await run(queries.reportBuilderMoodle.entregas(lote))) d.entregadas.add(par(r.assignment, r.userid));
    }
    return d;
}

async function desdeREST(rows, conCurso, rest) {
    let respondio = false;
    const usuarios = [];
    for (const [field, key] of [['username', '_username'], ['idnumber', '_documento']]) {
        const valores = distintos(rows, key);
        for (let i = 0; i < valores.length; i += 100) {
            const params = {};
            valores.slice(i, i + 100).forEach((v, j) => { params[`values[${j}]`] = v; });
            const r = await rest('core_user_get_users_by_field', { field, ...params });
            if (Array.isArray(r)) { respondio = true; usuarios.push(...r); }
        }
    }
    const d = { completo: false, cursoPorIdnumber: new Map(), cursoPorShortname: new Map(), matriculas: new Set(), accesoCurso: new Map() };
    if (conCurso) {
        for (const idnumber of distintos(rows, '_curso_idnumber')) {
            const r = await rest('core_course_get_courses_by_field', { field: 'idnumber', value: idnumber });
            const curso = r && Array.isArray(r.courses) ? r.courses[0] : null;
            if (r) respondio = true;
            if (!curso) continue;
            d.cursoPorIdnumber.set(idnumber, curso.id);
            const enrol = await rest('core_enrol_get_enrolled_users', { courseid: curso.id });
            for (const u of Array.isArray(enrol) ? enrol : []) {
                usuarios.push(u);
                d.matriculas.add(par(u.id, curso.id));
                if (u.lastcourseaccess) d.accesoCurso.set(par(u.id, curso.id), u.lastcourseaccess);
            }
        }
    }
    return respondio ? { ...d, ...mapaUsuarios(usuarios) } : null;
}

function llenar(row, d, conCurso) {
    const mu = d.porUsername.get(low(row._username)) || d.porIdnumber.get(low(row._documento)) || d.porUsername.get(low(row._documento));
    row.m_en_moodle = !!mu;
    row.m_ultimo_acceso_plataforma = mu ? fecha(mu.lastaccess) : null;
    row.m_nunca_entro_plataforma = mu ? !mu.lastaccess : null;
    row.m_dias_sin_entrar_plataforma = mu ? dias(mu.lastaccess) : null;
    row.m_perfil_url = mu ? moodleUserUrl(mu.id) : null;
    if (!conCurso) return;

    const cid = d.cursoPorIdnumber.get(low(row._curso_idnumber)) || d.cursoPorShortname.get(low(row._curso_shortname));
    const k = mu && cid ? par(mu.id, cid) : null;
    row.m_matricula_en_moodle = !!k && d.matriculas.has(k);
    if (!row.m_matricula_en_moodle) return;
    const ts = d.accesoCurso.get(k);
    row.m_ultimo_acceso_curso = fecha(ts);
    row.m_nunca_entro_curso = !ts;
    row.m_dias_sin_entrar_curso = dias(ts);
    if (!d.completo) return;

    const nota = d.notas.get(k);
    row.m_calificacion = nota && nota.finalgrade != null && Number(nota.grademax) > 0
        ? Math.round((Number(nota.finalgrade) / Number(nota.grademax)) * 50) / 10
        : 'Sin nota';
    const total = d.totales.get(cid);
    row.m_avance = total ? Math.round(((d.hechas.get(k) || 0) / total) * 100) : null;
    row.m_entregas_vencidas = (d.tareas.get(cid) || []).filter((a) => !d.entregadas.has(par(a, mu.id))).length;
}

// rows: filas con las claves ocultas _username, _documento (y _curso_* en
// matrículas). Las modifica en el sitio. Devuelve los avisos para el usuario.
async function enriquecerMoodle(rows, { dataset, mysql, rest } = {}) {
    const conCurso = dataset === 'matriculas';
    mysql = mysql || (async (text, values) => (await require('../../../database/mysqlMoodle').query(text, values))[0]);
    rest = rest || require('../../moodleService').moodleRequest;
    const avisos = [];
    let d;
    try {
        d = await desdeBD(rows, conCurso, mysql);
    } catch (err) {
        console.error('Constructor de reportes: BD de Moodle no disponible, se usa REST:', err.code || err.message);
        d = await desdeREST(rows, conCurso, rest).catch(() => null);
        avisos.push(d ? AVISO_REST : AVISO_SIN_MOODLE);
    }
    if (d) rows.forEach((r) => llenar(r, d, conCurso));
    return { avisos };
}

module.exports = { enriquecerMoodle };
