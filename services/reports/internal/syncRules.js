const db = require('../../../database/postgresql');
const config = require('../../../config');
const { meta } = require('../_util');
const schema = config.postgresql.schema;

async function syncRules(params = {}) {
    const rows = await db.query({
        text: `SELECT sr.id, sr.codigo_asignatura, sr.programa, sr.departamento, sr.seed_shortname,
                      sr.categoryid, sr.activo, COUNT(c.id)::int AS cursos_asociados
               FROM ${schema}.sync_rules sr
               LEFT JOIN ${schema}.courses c ON c.codigo_asignatura = sr.codigo_asignatura
               GROUP BY sr.id ORDER BY sr.activo DESC, sr.id`,
        values: [],
    });
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
