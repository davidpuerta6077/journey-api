// Siembra idempotente de los submódulos de cuenta Moodle (plugin local_nexo):
// moodle_unlock_user y moodle_reset_mfa, en el mismo módulo que reset_password_user
// (Módulo Usuarios), y los otorga al rol superadmin.
// Uso: node database/seeds/seedMoodleAccountSubmodules.js

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

const SIBLING_CODE = 'reset_password_user';
const NEW_SUBMODULES = [
    { code: 'moodle_unlock_user', name: 'Desbloquear usuario en Moodle' },
    { code: 'moodle_reset_mfa',   name: 'Reiniciar doble factor en Moodle' },
];
const GRANTED_ROLE_NAME = 'superadmin';

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

async function ensureGrant(roleId, submoduleId, code) {
    const existing = await pool.query(
        `SELECT id FROM ${schema}.role_permissions WHERE role_id = $1 AND submodule_id = $2 LIMIT 1`,
        [roleId, submoduleId]
    );
    if (existing.rows.length > 0) {
        console.log(`  Permiso '${code}' ya otorgado a ${GRANTED_ROLE_NAME}`);
        return;
    }
    await pool.query(`INSERT INTO ${schema}.role_permissions (role_id, submodule_id) VALUES ($1, $2)`, [roleId, submoduleId]);
    console.log(`  Permiso '${code}' otorgado a ${GRANTED_ROLE_NAME}`);
}

async function main() {
    const sibling = await pool.query(`SELECT module_id FROM ${schema}.submodules WHERE code = $1 LIMIT 1`, [SIBLING_CODE]);
    if (sibling.rows.length === 0) throw new Error(`No existe el submódulo '${SIBLING_CODE}' para ubicar el módulo de usuarios`);
    const moduleId = sibling.rows[0].module_id;

    const role = await pool.query(`SELECT id FROM ${schema}.roles WHERE name = $1 LIMIT 1`, [GRANTED_ROLE_NAME]);
    if (role.rows.length === 0) throw new Error(`No existe el rol '${GRANTED_ROLE_NAME}'`);

    for (const submodule of NEW_SUBMODULES) {
        const id = await ensureSubmodule(moduleId, submodule);
        await ensureGrant(role.rows[0].id, id, submodule.code);
    }
    console.log('Listo.');
}

main()
    .catch((err) => {
        console.error('Error sembrando submódulos de cuenta Moodle:', err.message);
        process.exitCode = 1;
    })
    .finally(() => pool.end());
