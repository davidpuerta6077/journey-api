const moodleDB = require('../../../database/mysqlMoodle');
const queries = require('../../../database/querysets');

// Reporte 'moodle_courses_by_category': conteo de cursos y estudiantes por
// categoría de Moodle. Lee directo de la BD de Moodle (mismo patrón que
// services/moodle/*). Devuelve el formato unificado { columns, rows, meta }.
async function coursesByCategory(params = {}) {
    const categoryId = params.categoryId != null && params.categoryId !== ''
        ? Number(params.categoryId)
        : null;
    const incluirSubcategorias = params.incluirSubcategorias !== false;

    const query = queries.countCoursesStudentsByCategory({ categoryId, incluirSubcategorias });
    const [rows] = await moodleDB.query(query.text, query.values);

    return {
        columns: [
            { key: 'categoria', label: 'Categoría' },
            { key: 'cursos', label: 'Cursos' },
            { key: 'estudiantes', label: 'Estudiantes' },
        ],
        rows: rows.map((r) => ({
            categoria: r.categoria,
            cursos: Number(r.cursos),
            estudiantes: Number(r.estudiantes),
        })),
        meta: {
            tipo: 'moodle_courses_by_category',
            params: { categoryId, incluirSubcategorias },
            generatedAt: new Date().toISOString(),
        },
    };
}

module.exports = { coursesByCategory };
