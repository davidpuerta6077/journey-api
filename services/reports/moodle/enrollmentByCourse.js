const { resumenPorCurso } = require('./_moodleRest');
const { meta, normCategoryId } = require('../_util');

async function enrollmentByCourse(params = {}) {
    const categoryId = normCategoryId(params.categoryId);
    const resumen = await resumenPorCurso(categoryId);
    return {
        columns: [
            { key: 'curso', label: 'Curso' },
            { key: 'categoria', label: 'Categoría' },
            { key: 'estudiantes', label: 'Estudiantes' },
            { key: 'profesores', label: 'Profesores' },
            { key: 'total', label: 'Total matriculados' },
        ],
        rows: resumen.map((r) => ({
            curso: r.curso,
            categoria: r.categoria,
            estudiantes: r.estudiantes,
            profesores: r.profesores,
            total: r.total,
        })),
        meta: meta('moodle_enrollment_by_course', { categoryId }),
    };
}
module.exports = { enrollmentByCourse };
