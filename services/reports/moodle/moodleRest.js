const { moodleRequest } = require('../../moodleService');
const { assertMoodleOk } = require('../../moodleAssert');

async function getCategorias() {
    return assertMoodleOk(
        await moodleRequest('core_course_get_categories', {}),
        'Error listando categorías de Moodle'
    );
}

// Filtra el árbol de categorías por id (y opcionalmente sus descendientes vía path).
function filtrarCategorias(cats, categoryId, incluirSub = true) {
    if (categoryId == null) return cats;
    const raiz = cats.find((c) => Number(c.id) === Number(categoryId));
    if (!raiz) return [];
    if (!incluirSub) return [raiz];
    return cats.filter((c) =>
        Number(c.id) === Number(categoryId) ||
        String(c.path || '').split('/').filter(Boolean).map(Number).includes(Number(categoryId))
    );
}

async function getCursosDeCategoria(catId) {
    const res = await moodleRequest('core_course_get_courses_by_field', { field: 'category', value: catId });
    return res && Array.isArray(res.courses) ? res.courses.filter((c) => c.id !== 1) : [];
}

// null si el webservice no devolvió un array (no habilitado / error).
async function getEnrolados(courseid) {
    const r = await moodleRequest('core_enrol_get_enrolled_users', { courseid });
    return Array.isArray(r) ? r : null;
}

function tieneRol(u, shortname) {
    return Array.isArray(u.roles) && u.roles.some((r) => r.shortname === shortname);
}
function esProfesor(u) {
    return tieneRol(u, 'editingteacher') || tieneRol(u, 'teacher');
}

// días transcurridos desde un timestamp Unix (segundos). 0/null/undefined => null (nunca accedió).
function diasDesde(ts) {
    if (!ts) return null;
    return Math.floor((Date.now() / 1000 - ts) / 86400);
}
function fechaCorta(ts) {
    return ts ? new Date(ts * 1000).toISOString().slice(0, 10) : 'nunca';
}

// Devuelve [{ curso, categoria, categoria_id, estudiantes, profesores, total }]
// estudiantes/profesores/total = null si core_enrol_get_enrolled_users falló para ese curso.
async function resumenPorCurso(categoryId) {
    const cats = filtrarCategorias(await getCategorias(), categoryId, true);
    const out = [];
    for (const cat of cats) {
        const cursos = await getCursosDeCategoria(cat.id);
        for (const curso of cursos) {
            const enrol = await getEnrolados(curso.id);
            if (!enrol) {
                out.push({ curso: curso.fullname, categoria: cat.name, categoria_id: cat.id, estudiantes: null, profesores: null, total: null });
                continue;
            }
            out.push({
                curso: curso.fullname,
                categoria: cat.name,
                categoria_id: cat.id,
                estudiantes: enrol.filter((u) => tieneRol(u, 'student')).length,
                profesores: enrol.filter((u) => esProfesor(u)).length,
                total: enrol.length,
            });
        }
    }
    return out;
}

module.exports = { getCategorias, filtrarCategorias, getCursosDeCategoria, getEnrolados, tieneRol, diasDesde, fechaCorta, resumenPorCurso };
