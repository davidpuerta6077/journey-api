const db = require('../../../database/postgresql');
const config = require('../../../config');
const { meta } = require('../_util');
const schema = config.postgresql.schema;

async function permissionsMatrix(params = {}) {
    const rows = await db.query({
        text: `SELECT r.name AS rol, m.name AS aplicacion, sm.name AS submodulo
               FROM ${schema}.role_permissions rp
               JOIN ${schema}.roles r ON r.id = rp.role_id
               JOIN ${schema}.submodules sm ON sm.id = rp.submodule_id
               JOIN ${schema}.modules m ON m.id = sm.module_id
               ORDER BY r.name, m.name, sm.name`,
        values: [],
    });
    return {
        columns: [
            { key: 'rol', label: 'Rol' },
            { key: 'aplicacion', label: 'Aplicación' },
            { key: 'submodulo', label: 'Submódulo' },
        ],
        rows: rows.map((r) => ({ rol: r.rol, aplicacion: r.aplicacion, submodulo: r.submodulo })),
        meta: meta('journey_permissions_matrix', params),
    };
}
module.exports = { permissionsMatrix };
