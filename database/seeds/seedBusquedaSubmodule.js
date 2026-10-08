// El menú y la ruta /busqueda (SideNavItems.jsx, App.jsx) siempre esperaron
// el submódulo 'search' bajo nexo_sync, pero nunca se sembró en la BD -- por
// eso ni siquiera superadmin podía entrar ("Sin permisos para acceder").
// Idempotente. Uso: node database/seeds/seedBusquedaSubmodule.js

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

const MODULE_CODE = 'nexo_sync';
const NEW_SUBMODULE = { code: 'search', name: 'Búsqueda' };
const GRANTED_ROLE_NAME = 'superadmin';

async function main() {
    console.log(`Sembrando submódulo '${NEW_SUBMODULE.code}' en schema '${schema}'...`);

    const moduleResult = await pool.query(`SELECT id FROM ${schema}.modules WHERE code = $1 LIMIT 1`, [MODULE_CODE]);
    if (moduleResult.rows.length === 0) throw new Error(`No existe el módulo '${MODULE_CODE}'`);
    const moduleId = moduleResult.rows[0].id;

    const roleResult = await pool.query(`SELECT id FROM ${schema}.roles WHERE name = $1 LIMIT 1`, [GRANTED_ROLE_NAME]);
    if (roleResult.rows.length === 0) throw new Error(`No existe el rol '${GRANTED_ROLE_NAME}'`);
    const roleId = roleResult.rows[0].id;

    let submoduleId;
    const existing = await pool.query(`SELECT id FROM ${schema}.submodules WHERE module_id = $1 AND code = $2 LIMIT 1`, [moduleId, NEW_SUBMODULE.code]);
    if (existing.rows.length > 0) {
        submoduleId = existing.rows[0].id;
        console.log(`Submódulo '${NEW_SUBMODULE.code}' ya existe (id=${submoduleId})`);
    } else {
        const inserted = await pool.query(
            `INSERT INTO ${schema}.submodules (module_id, code, name) VALUES ($1, $2, $3) RETURNING id`,
            [moduleId, NEW_SUBMODULE.code, NEW_SUBMODULE.name]
        );
        submoduleId = inserted.rows[0].id;
        console.log(`Submódulo '${NEW_SUBMODULE.code}' creado (id=${submoduleId})`);
    }

    const grant = await pool.query(`SELECT id FROM ${schema}.role_permissions WHERE role_id = $1 AND submodule_id = $2 LIMIT 1`, [roleId, submoduleId]);
    if (grant.rows.length > 0) {
        console.log(`Permiso ya otorgado a ${GRANTED_ROLE_NAME}`);
    } else {
        await pool.query(`INSERT INTO ${schema}.role_permissions (role_id, submodule_id) VALUES ($1, $2)`, [roleId, submoduleId]);
        console.log(`Permiso otorgado a ${GRANTED_ROLE_NAME}`);
    }

    console.log('Listo.');
}

main()
    .catch((err) => {
        console.error('Error sembrando el submódulo search:', err.message);
        process.exitCode = 1;
    })
    .finally(() => pool.end());
