const { resumenPorCurso } = require('./moodleRest');
const { meta, normCategoryId } = require('../util');

async function enrollmentByCourse(params = {}) {
    const categoryId = normCategoryId(params.categoryId);
    const resumen = await resumenPorCurso(categoryId);
    return {
        columns: [
            { key: 'curso', label: 'Curso', link: 'curso_url' },
            { key: 'categoria', label: 'Categoría' },
            { key: 'estudiantes', label: 'Estudiantes' },
            { key: 'profesores', label: 'Profesores' },
            { key: 'total', label: 'Total matriculados' },
        ],
        rows: resumen.map((r) => ({
            curso: r.curso,
            curso_url: r.curso_url,
            categoria: r.categoria,
            estudiantes: r.estudiantes,
            profesores: r.profesores,
            total: r.total,
        })),
        meta: meta('moodle_enrollment_by_course', { categoryId }),
    };
}
module.exports = { enrollmentByCourse };
