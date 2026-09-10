const { resumenPorCurso } = require('./_moodleRest');
const { meta, normCategoryId } = require('../_util');

async function coursesWithoutTeacher(params = {}) {
    const categoryId = normCategoryId(params.categoryId);
    const resumen = await resumenPorCurso(categoryId);
    return {
        columns: [
            { key: 'curso', label: 'Curso' },
            { key: 'categoria', label: 'Categoría' },
            { key: 'estudiantes', label: 'Estudiantes' },
        ],
        rows: resumen
            .filter((r) => r.profesores != null && r.profesores === 0)
            .map((r) => ({ curso: r.curso, categoria: r.categoria, estudiantes: r.estudiantes })),
        meta: meta('moodle_courses_without_teacher', { categoryId }),
    };
}
module.exports = { coursesWithoutTeacher };
