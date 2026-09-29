const moodleDB = require('../../../database/mysqlMoodle');
const queries = require('../../../database/querysets');
const { getCategorias, filtrarCategorias, getCursosDeCategoria, getEnrolados, tieneRol } = require('./moodleRest');
const { normCategoryId, moodleCourseUrl } = require('../util');

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

// Detalle: cada curso de las categorías del resumen (clic en una categoría
// del gráfico filtra por la columna `categoria`).
const DETALLE_COLUMNS = [
    { key: 'curso', label: 'Curso', link: 'curso_url' },
    { key: 'shortname', label: 'Nombre corto' },
    { key: 'categoria', label: 'Categoría' },
    { key: 'estudiantes', label: 'Estudiantes' },
    { key: 'profesores', label: 'Profesores' },
    { key: 'visible', label: 'Visible' },
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
    const qDetalle = queries.coursesDetailByCategory({ categoryId, incluirSubcategorias });
    const [cursos] = await moodleDB.query(qDetalle.text, qDetalle.values);
    return {
        rows: rows.map((r) => ({
            categoria: r.categoria,
            path: r.path,
            cursos: Number(r.cursos),
            estudiantes: Number(r.estudiantes),
        })),
        cursos: cursos.map((c) => ({
            curso: c.curso,
            curso_url: moodleCourseUrl(c.curso_id),
            shortname: c.shortname,
            categoria: c.categoria,
            estudiantes: Number(c.estudiantes),
            profesores: Number(c.profesores),
            visible: Number(c.visible) === 1 ? 'Sí' : 'No',
        })),
    };
}

// ─── Fuente 2: REST API de Moodle (fallback) ─────────────────────────────────
async function desdeREST({ categoryId, incluirSubcategorias }) {
    const objetivo = filtrarCategorias(await getCategorias(), categoryId, incluirSubcategorias);

    const filas = [];
    const detalle = [];
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
            const enrol = contable ? await getEnrolados(curso.id) : null;
            if (!enrol) contable = false;
            for (const u of enrol || []) {
                if (tieneRol(u, 'student')) alumnos.add(u.id);
            }
            detalle.push({
                curso: curso.fullname,
                curso_url: moodleCourseUrl(curso.id),
                shortname: curso.shortname,
                categoria: cat.name,
                estudiantes: enrol ? enrol.filter((u) => tieneRol(u, 'student')).length : null,
                profesores: enrol ? enrol.filter((u) => tieneRol(u, 'editingteacher') || tieneRol(u, 'teacher')).length : null,
                visible: Number(curso.visible) === 1 ? 'Sí' : 'No',
            });
        }

        filas.push({
            categoria: cat.name,
            path: cat.path,
            cursos: cursos.length,
            estudiantes: contable ? alumnos.size : null,
        });
    }
    return { rows: filas, cursos: detalle };
}

async function coursesByCategory(params = {}) {
    const norm = normalizarParams(params);

    let datos;
    let fuente = 'db';
    try {
        datos = await desdeDB(norm);
    } catch (err) {
        if (!esErrorDeConexion(err)) throw err;
        fuente = 'rest';
        datos = await desdeREST(norm);
    }

    return {
        columns: COLUMNS,
        rows: datos.rows,
        detalle: { titulo: 'Cursos', columns: DETALLE_COLUMNS, rows: datos.cursos },
        meta: {
            tipo: 'moodle_courses_by_category',
            params: norm,
            fuente,
            generatedAt: new Date().toISOString(),
        },
    };
}

module.exports = { coursesByCategory };
