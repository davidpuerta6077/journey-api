const db = require('../../../database/postgresql');
const { meta } = require('../_util');

async function platformUsersByRole(params = {}) {
    const rows = await db.reportPlatformUsersByRole();
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
