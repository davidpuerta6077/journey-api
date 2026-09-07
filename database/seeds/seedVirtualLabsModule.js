// Siembra idempotente del módulo "Laboratorios Virtuales" y otorga el permiso
// del submódulo de calificaciones (labs_grades) solo al rol superadmin.
// Uso: node database/seeds/seedVirtualLabsModule.js

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

const MODULE = { code: 'virtual_labs', name: 'Laboratorios Virtuales' };
const SUBMODULES = [
    { code: 'virtual_labs_grades', name: 'Laboratorios Virtuales - Calificaciones' },
];
const GRANTED_ROLE_NAME = 'superadmin';

async function ensureModule() {
    const existing = await pool.query(
        `SELECT id FROM ${schema}.modules WHERE code = $1 LIMIT 1`,
        [MODULE.code]
    );
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
    const existing = await pool.query(
        `SELECT id FROM ${schema}.submodules WHERE code = $1 LIMIT 1`,
        [submodule.code]
    );
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

async function ensureGrant(roleId, submoduleId, submoduleCode) {
    const existing = await pool.query(
        `SELECT id FROM ${schema}.role_permissions WHERE role_id = $1 AND submodule_id = $2 LIMIT 1`,
        [roleId, submoduleId]
    );
    if (existing.rows.length > 0) {
        console.log(`  Permiso '${submoduleCode}' ya otorgado a ${GRANTED_ROLE_NAME}`);
        return;
    }
    await pool.query(
        `INSERT INTO ${schema}.role_permissions (role_id, submodule_id) VALUES ($1, $2)`,
        [roleId, submoduleId]
    );
    console.log(`  Permiso '${submoduleCode}' otorgado a ${GRANTED_ROLE_NAME}`);
}

async function main() {
    console.log(`Sembrando módulo virtual_labs en schema '${schema}'...`);

    const roleResult = await pool.query(
        `SELECT id FROM ${schema}.roles WHERE name = $1 LIMIT 1`,
        [GRANTED_ROLE_NAME]
    );
    if (roleResult.rows.length === 0) {
        throw new Error(`No existe el rol '${GRANTED_ROLE_NAME}' — no se puede otorgar acceso inicial`);
    }
    const superadminRoleId = roleResult.rows[0].id;

    const moduleId = await ensureModule();

    for (const submodule of SUBMODULES) {
        const submoduleId = await ensureSubmodule(moduleId, submodule);
        await ensureGrant(superadminRoleId, submoduleId, submodule.code);
    }

    console.log('Listo.');
}

main()
    .catch((err) => {
        console.error('Error sembrando el módulo virtual_labs:', err.message);
        process.exitCode = 1;
    })
    .finally(() => pool.end());
