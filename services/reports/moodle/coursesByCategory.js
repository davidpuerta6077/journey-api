const moodleDB = require('../../../database/mysqlMoodle');
const queries = require('../../../database/querysets');
const { moodleRequest } = require('../../moodleService');
const { assertMoodleOk } = require('../../moodleAssert');

// Reporte 'moodle_courses_by_category': conteo de cursos y estudiantes (rol
// 'student') por categoría de Moodle. Devuelve el formato unificado
// { columns, rows, meta }.
//
// Dos fuentes:
//  1. BD MySQL de Moodle directo (eficiente: una query agregada). Es la vía
//     por defecto y la única viable en producción con volumen.
//  2. REST API de Moodle (fallback): si la BD no es alcanzable (entorno sin
//     acceso a la RDS), se arma el mismo resultado con webservices. Más lento
//     (N llamadas por categoría), pero funciona desde cualquier red.
// meta.fuente indica cuál se usó ('db' | 'rest').

const COLUMNS = [
    { key: 'categoria', label: 'Categoría' },
    { key: 'path', label: 'Ruta' },
    { key: 'cursos', label: 'Cursos' },
    { key: 'estudiantes', label: 'Estudiantes' },
];

// Códigos de error que significan "no se pudo conectar a la BD" -> usar REST.
// Un error de credenciales o de SQL NO entra acá: eso se propaga tal cual.
const CONN_ERROR_CODES = new Set([
    'ETIMEDOUT', 'ECONNREFUSED', 'ENOTFOUND', 'EHOSTUNREACH', 'EAI_AGAIN',
    'PROTOCOL_CONNECTION_LOST', 'PROTOCOL_SEQUENCE_TIMEOUT', 'ER_CON_COUNT_ERROR',
]);

function esErrorDeConexion(err) {
    if (!err) return false;
    if (CONN_ERROR_CODES.has(err.code)) return true;
    return /ETIMEDOUT|ECONNREFUSED|ENOTFOUND|EHOSTUNREACH|getaddrinfo|connect timeout/i
        .test(err.message || '');
}

function normalizarParams(params = {}) {
    const n = Number(params.categoryId);
    const categoryId = params.categoryId != null && params.categoryId !== '' && Number.isFinite(n)
        ? n
        : null;
    const incluirSubcategorias = params.incluirSubcategorias === true || params.incluirSubcategorias === 'true'
        ? true
        : params.incluirSubcategorias === false || params.incluirSubcategorias === 'false'
        ? false
        : true; // default
    return { categoryId, incluirSubcategorias };
}

// ─── Fuente 1: BD MySQL de Moodle ────────────────────────────────────────────
async function desdeDB({ categoryId, incluirSubcategorias }) {
    const query = queries.countCoursesStudentsByCategory({ categoryId, incluirSubcategorias });
    const [rows] = await moodleDB.query(query.text, query.values);
    return rows.map((r) => ({
        categoria: r.categoria,
        path: r.path,
        cursos: Number(r.cursos),
        estudiantes: Number(r.estudiantes),
    }));
}

// ─── Fuente 2: REST API de Moodle (fallback) ─────────────────────────────────
async function desdeREST({ categoryId, incluirSubcategorias }) {
    const categorias = assertMoodleOk(
        await moodleRequest('core_course_get_categories', {}),
        'Error listando categorías de Moodle'
    );

    let objetivo = categorias;
    if (categoryId != null) {
        const raiz = categorias.find((c) => Number(c.id) === categoryId);
        if (!raiz) return [];
        objetivo = incluirSubcategorias
            ? categorias.filter((c) => Number(c.id) === categoryId
                || String(c.path || '').split('/').filter(Boolean).map(Number).includes(categoryId))
            : [raiz];
    }

    const filas = [];
    for (const cat of objetivo) {
        const res = await moodleRequest('core_course_get_courses_by_field', { field: 'category', value: cat.id });
        const cursos = res && Array.isArray(res.courses)
            ? res.courses.filter((c) => c.id !== 1)
            : [];

        // Conteo de estudiantes: una llamada por curso. Si el webservice
        // core_enrol_get_enrolled_users no está habilitado o falla, se deja
        // estudiantes = null en esa categoría en vez de romper todo el reporte.
        let estudiantes = 0;
        let contable = true;
        for (const curso of cursos) {
            const enrol = await moodleRequest('core_enrol_get_enrolled_users', { courseid: curso.id });
            if (!Array.isArray(enrol)) { contable = false; break; }
            estudiantes += enrol.filter((u) =>
                Array.isArray(u.roles) && u.roles.some((r) => r.shortname === 'student')
            ).length;
        }

        filas.push({
            categoria: cat.name,
            path: cat.path,
            cursos: cursos.length,
            estudiantes: contable ? estudiantes : null,
        });
    }
    return filas;
}

async function coursesByCategory(params = {}) {
    const norm = normalizarParams(params);

    let rows;
    let fuente = 'db';
    try {
        rows = await desdeDB(norm);
    } catch (err) {
        if (!esErrorDeConexion(err)) throw err;
        fuente = 'rest';
        rows = await desdeREST(norm);
    }

    return {
        columns: COLUMNS,
        rows,
        meta: {
            tipo: 'moodle_courses_by_category',
            params: norm,
            fuente,
            generatedAt: new Date().toISOString(),
        },
    };
}

module.exports = { coursesByCategory };
