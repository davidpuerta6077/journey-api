const moodleDB = require('../../../database/mysqlMoodle');
const queries = require('../../../database/querysets');
const { getCategorias, filtrarCategorias, getCursosDeCategoria, getEnrolados, tieneRol } = require('./moodleRest');
const { normCategoryId } = require('../util');

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
    const incluirSubcategorias = params.incluirSubcategorias === true || params.incluirSubcategorias === 'true'
        ? true
        : params.incluirSubcategorias === false || params.incluirSubcategorias === 'false'
        ? false
        : true; // default
    return { categoryId: normCategoryId(params.categoryId), incluirSubcategorias };
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
    const objetivo = filtrarCategorias(await getCategorias(), categoryId, incluirSubcategorias);

    const filas = [];
    for (const cat of objetivo) {
        const cursos = await getCursosDeCategoria(cat.id);

        // Conteo de estudiantes alineado con la rama BD (COUNT(DISTINCT ra.userid)):
        // un estudiante matriculado en varios cursos de la categoría cuenta 1 vez.
        // Una llamada por curso; si core_enrol_get_enrolled_users no está
        // habilitado o falla, se deja estudiantes = null en esa categoría en vez
        // de romper todo el reporte.
        const alumnos = new Set();
        let contable = true;
        for (const curso of cursos) {
            const enrol = await getEnrolados(curso.id);
            if (!enrol) { contable = false; break; }
            for (const u of enrol) {
                if (tieneRol(u, 'student')) alumnos.add(u.id);
            }
        }

        filas.push({
            categoria: cat.name,
            path: cat.path,
            cursos: cursos.length,
            estudiantes: contable ? alumnos.size : null,
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
