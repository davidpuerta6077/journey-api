const { getCategorias, filtrarCategorias, getCursosDeCategoria } = require('./moodleRest');
const { meta, normCategoryId } = require('../util');

async function hiddenCourses(params = {}) {
    const categoryId = normCategoryId(params.categoryId);
    const cats = filtrarCategorias(await getCategorias(), categoryId, true);

    const rows = [];
    for (const cat of cats) {
        const cursos = await getCursosDeCategoria(cat.id);
        for (const c of cursos) {
            if (Number(c.visible) === 0) {
                rows.push({
                    curso: c.fullname,
                    shortname: c.shortname,
                    categoria: cat.name,
                    idnumber: c.idnumber || '',
                });
            }
        }
    }

    return {
        columns: [
            { key: 'curso', label: 'Curso' },
            { key: 'shortname', label: 'Nombre corto' },
            { key: 'categoria', label: 'Categoría' },
            { key: 'idnumber', label: 'ID number' },
        ],
        rows,
        meta: meta('moodle_hidden_courses', { categoryId }),
    };
}
module.exports = { hiddenCourses };
