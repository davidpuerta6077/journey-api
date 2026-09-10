const db = require('../../../database/postgresql');
const config = require('../../../config');
const { meta } = require('../_util');
const schema = config.postgresql.schema;

async function platformUsersByRole(params = {}) {
    const rows = await db.query({
        text: `SELECT r.name AS rol,
                      COUNT(pu.id)::int AS usuarios,
                      (COUNT(pu.id) FILTER (WHERE pu.estado IS TRUE))::int AS activos,
                      (COUNT(pu.id) FILTER (WHERE pu.last_login IS NOT NULL))::int AS con_ingreso
               FROM ${schema}.roles r
               LEFT JOIN ${schema}.platform_users pu ON pu.role_id = r.id
               GROUP BY r.name ORDER BY usuarios DESC`,
        values: [],
    });
    return {
        columns: [
            { key: 'rol', label: 'Rol' },
            { key: 'usuarios', label: 'Usuarios' },
            { key: 'activos', label: 'Activos' },
            { key: 'con_ingreso', label: 'Con ingreso registrado' },
        ],
        rows: rows.map((r) => ({ rol: r.rol, usuarios: r.usuarios, activos: r.activos, con_ingreso: r.con_ingreso })),
        meta: meta('journey_platform_users_by_role', params),
    };
}
module.exports = { platformUsersByRole };
