const db = require('../../../database/postgresql');
const { meta } = require('../util');

async function syncRules(params = {}) {
    const rows = await db.reportSyncRules();
    return {
        columns: [
            { key: 'id', label: 'ID' },
            { key: 'codigo_asignatura', label: 'Cód. asignatura' },
            { key: 'programa', label: 'Programa' },
            { key: 'departamento', label: 'Departamento' },
            { key: 'seed_shortname', label: 'Semilla' },
            { key: 'categoryid', label: 'Categoría' },
            { key: 'activo', label: 'Activa' },
            { key: 'cursos_asociados', label: 'Cursos asociados' },
        ],
        rows: rows.map((r) => ({
            id: r.id,
            codigo_asignatura: r.codigo_asignatura,
            programa: r.programa,
            departamento: r.departamento,
            seed_shortname: r.seed_shortname,
            categoryid: r.categoryid,
            activo: r.activo,
            cursos_asociados: r.cursos_asociados,
        })),
        meta: meta('journey_sync_rules', params),
    };
}
module.exports = { syncRules };
