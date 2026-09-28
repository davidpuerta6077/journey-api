const db = require('../../../database/postgresql');
const { meta } = require('../util');

async function platformUsersByRole(params = {}) {
    const [rows, usuarios] = await Promise.all([db.reportPlatformUsersByRole(), db.reportPlatformUsersDetail()]);
    return {
        columns: [
            { key: 'rol', label: 'Rol' },
            { key: 'usuarios', label: 'Usuarios' },
            { key: 'activos', label: 'Activos' },
            { key: 'con_ingreso', label: 'Con ingreso registrado' },
        ],
        rows: rows.map((r) => ({ rol: r.rol, usuarios: r.usuarios, activos: r.activos, con_ingreso: r.con_ingreso })),
        detalle: {
            titulo: 'Usuarios de plataforma',
            columns: [
                { key: 'username', label: 'Usuario' },
                { key: 'email', label: 'Correo' },
                { key: 'rol', label: 'Rol' },
                { key: 'activo', label: 'Estado' },
                { key: 'departamento', label: 'Departamento' },
                { key: 'last_login', label: 'Último ingreso' },
            ],
            rows: usuarios.map((u) => ({ ...u, activo: u.estado ? 'Activo' : 'Inactivo' })),
        },
        meta: meta('journey_platform_users_by_role', params),
    };
}
module.exports = { platformUsersByRole };
