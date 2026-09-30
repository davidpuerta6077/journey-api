const { resumenPorCurso } = require('./moodleRest');
const { meta, normCategoryId, normInt } = require('../util');

async function coursesWithoutStudents(params = {}) {
    const maxEstudiantes = normInt(params.maxEstudiantes, 1, { min: 0 });
    const categoryId = normCategoryId(params.categoryId);
    const resumen = await resumenPorCurso(categoryId);
    return {
        columns: [
            { key: 'curso', label: 'Curso', link: 'curso_url' },
            { key: 'categoria', label: 'Categoría' },
            { key: 'estudiantes', label: 'Estudiantes' },
        ],
        rows: resumen
            .filter((r) => r.estudiantes != null && r.estudiantes <= maxEstudiantes)
            .map((r) => ({ curso: r.curso, curso_url: r.curso_url, categoria: r.categoria, estudiantes: r.estudiantes })),
        meta: meta('moodle_courses_without_students', { maxEstudiantes, categoryId }),
    };
}
module.exports = { coursesWithoutStudents };
