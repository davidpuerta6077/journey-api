const { resumenPorCurso } = require('./moodleRest');
const { meta, normCategoryId } = require('../util');

async function coursesWithoutTeacher(params = {}) {
    const categoryId = normCategoryId(params.categoryId);
    const resumen = await resumenPorCurso(categoryId);
    return {
        columns: [
            { key: 'curso', label: 'Curso', link: 'curso_url' },
            { key: 'categoria', label: 'Categoría' },
            { key: 'estudiantes', label: 'Estudiantes' },
        ],
        rows: resumen
            .filter((r) => r.profesores != null && r.profesores === 0)
            .map((r) => ({ curso: r.curso, curso_url: r.curso_url, categoria: r.categoria, estudiantes: r.estudiantes })),
        meta: meta('moodle_courses_without_teacher', { categoryId }),
    };
}
module.exports = { coursesWithoutTeacher };
