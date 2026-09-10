const { resumenPorCurso } = require('./_moodleRest');
const { meta, normCategoryId, normInt } = require('../_util');

async function coursesWithoutStudents(params = {}) {
    const maxEstudiantes = normInt(params.maxEstudiantes, 1, { min: 0 });
    const categoryId = normCategoryId(params.categoryId);
    const resumen = await resumenPorCurso(categoryId);
    return {
        columns: [
            { key: 'curso', label: 'Curso' },
            { key: 'categoria', label: 'Categoría' },
            { key: 'estudiantes', label: 'Estudiantes' },
        ],
        rows: resumen
            .filter((r) => r.estudiantes != null && r.estudiantes <= maxEstudiantes)
            .map((r) => ({ curso: r.curso, categoria: r.categoria, estudiantes: r.estudiantes })),
        meta: meta('moodle_courses_without_students', { maxEstudiantes, categoryId }),
    };
}
module.exports = { coursesWithoutStudents };
