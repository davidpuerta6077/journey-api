const db = require('../../../database/postgresql');
const { getCategorias, filtrarCategorias, getCursosDeCategoria } = require('../moodle/moodleRest');
const { meta, normCategoryId } = require('../util');

async function syncDiscrepancies(params = {}) {
    const categoryId = normCategoryId(params.categoryId);

    const cursosJ = await db.reportCoursesForDiscrepancy();

    const cats = filtrarCategorias(await getCategorias(), categoryId, true);
    const moodleCursos = [];
    for (const cat of cats) {
        const cursos = await getCursosDeCategoria(cat.id);
        for (const c of cursos) moodleCursos.push({ id: c.id, shortname: c.shortname });
    }
    const moodleIds = new Set(moodleCursos.map((c) => Number(c.id)));
    const journeyMoodleIds = new Set(
        cursosJ.filter((c) => c.moodle_id != null).map((c) => Number(c.moodle_id))
    );

    const rows = [];
    for (const c of cursosJ) {
        if (c.moodle_id != null && !moodleIds.has(Number(c.moodle_id))) {
            rows.push({ tipo: 'falta_en_moodle', shortname: c.shortname, id_journey: c.id, moodle_id: c.moodle_id });
        }
        if (c.estado_sync === 'sincronizado' && c.moodle_id == null) {
            rows.push({ tipo: 'sincronizado_sin_moodle_id', shortname: c.shortname, id_journey: c.id, moodle_id: null });
        }
    }
    for (const mc of moodleCursos) {
        if (!journeyMoodleIds.has(Number(mc.id))) {
            rows.push({ tipo: 'falta_en_journey', shortname: mc.shortname, id_journey: null, moodle_id: mc.id });
        }
    }

    return {
        columns: [
            { key: 'tipo', label: 'Discrepancia' },
            { key: 'shortname', label: 'Nombre corto' },
            { key: 'id_journey', label: 'ID Journey' },
            { key: 'moodle_id', label: 'ID Moodle' },
        ],
        rows,
        meta: meta('sync_discrepancies', { categoryId }),
    };
}
module.exports = { syncDiscrepancies };
