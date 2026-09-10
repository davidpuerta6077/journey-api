const db = require('../../../database/postgresql');
const { meta } = require('../_util');

async function permissionsMatrix(params = {}) {
    const rows = await db.reportPermissionsMatrix();
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
