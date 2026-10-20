// Siembra idempotente del módulo "atom" y sus submódulos. Atom no tiene ruta
// ni entrada en el sidebar (vive dentro del Index como widget) — este módulo
// solo existe en BD para que checkPermission/Admin > Permisos lo controlen.
// atom_use y atom_assign se otorgan a todos los roles (tareas propias +
// asignar a un compañero, sin jerarquía); atom_admin solo a superadmin.
// Uso: node database/seeds/seedAtomModule.js

const { Pool } = require('pg');
const config = require('../../config');

const pool = new Pool({
    database: config.postgresql.database,
    user:     config.postgresql.user,
    password: config.postgresql.password,
    host:     config.postgresql.host,
    port:     config.postgresql.port,
});
const schema = config.postgresql.schema;

const MODULE = { code: 'atom', name: 'Atom' };
const SUBMODULES = [
    { code: 'atom_use',    name: 'Atom - Uso' },
    { code: 'atom_assign', name: 'Atom - Asignar tareas' },
    { code: 'atom_admin',  name: 'Atom - Administración' },
];
const GRANTS = {
    atom_use:    'ALL',
    atom_assign: 'ALL',
    atom_admin:  ['superadmin'],
};

async function ensureModule() {
    const existing = await pool.query(`SELECT id FROM ${schema}.modules WHERE code = $1 LIMIT 1`, [MODULE.code]);
    if (existing.rows.length > 0) {
        console.log(`Módulo '${MODULE.code}' ya existe (id=${existing.rows[0].id})`);
        return existing.rows[0].id;
    }
    const inserted = await pool.query(
        `INSERT INTO ${schema}.modules (code, name) VALUES ($1, $2) RETURNING id`,
        [MODULE.code, MODULE.name]
    );
    console.log(`Módulo '${MODULE.code}' creado (id=${inserted.rows[0].id})`);
    return inserted.rows[0].id;
}

async function ensureSubmodule(moduleId, submodule) {
    const existing = await pool.query(`SELECT id FROM ${schema}.submodules WHERE code = $1 LIMIT 1`, [submodule.code]);
    if (existing.rows.length > 0) {
        console.log(`  Submódulo '${submodule.code}' ya existe (id=${existing.rows[0].id})`);
        return existing.rows[0].id;
    }
    const inserted = await pool.query(
        `INSERT INTO ${schema}.submodules (module_id, code, name) VALUES ($1, $2, $3) RETURNING id`,
        [moduleId, submodule.code, submodule.name]
    );
    console.log(`  Submódulo '${submodule.code}' creado (id=${inserted.rows[0].id})`);
    return inserted.rows[0].id;
}

async function ensureGrant(roleId, roleName, submoduleId, submoduleCode) {
    const existing = await pool.query(
        `SELECT id FROM ${schema}.role_permissions WHERE role_id = $1 AND submodule_id = $2 LIMIT 1`,
        [roleId, submoduleId]
    );
    if (existing.rows.length > 0) {
        console.log(`  Permiso '${submoduleCode}' ya otorgado a ${roleName}`);
        return;
    }
    await pool.query(`INSERT INTO ${schema}.role_permissions (role_id, submodule_id) VALUES ($1, $2)`, [roleId, submoduleId]);
    console.log(`  Permiso '${submoduleCode}' otorgado a ${roleName}`);
}

async function main() {
    console.log(`Sembrando módulo atom en schema '${schema}'...`);

    const roles = (await pool.query(`SELECT id, name FROM ${schema}.roles`)).rows;
    if (roles.length === 0) throw new Error('No hay roles en la tabla roles — nada que sembrar');

    const moduleId = await ensureModule();
    for (const submodule of SUBMODULES) {
        const submoduleId = await ensureSubmodule(moduleId, submodule);
        const destino = GRANTS[submodule.code];
        const rolesDestino = destino === 'ALL' ? roles : roles.filter(r => destino.includes(r.name));
        for (const role of rolesDestino) {
            await ensureGrant(role.id, role.name, submoduleId, submodule.code);
        }
    }
    console.log('Listo.');
}

main()
    .catch((err) => {
        console.error('Error sembrando el módulo atom:', err.message);
        process.exitCode = 1;
    })
    .finally(() => pool.end());
