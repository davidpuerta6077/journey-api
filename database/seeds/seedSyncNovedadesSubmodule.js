// Siembra idempotente del submódulo "Novedades" (sync_enrollments_novedades)
// dentro del módulo existente nexo_sync, y otorga acceso al rol superadmin:
// tanto al submódulo nuevo (ver la página) como a los permisos de matrículas
// que ya usa para operar (sync_preview_enrollments/sync_enrollments), ya que
// Novedades reutiliza el mismo motor de sincronización que Sync Matrículas.
// El código incluye "enrollment" a propósito: AdminPermisos.jsx agrupa los
// submódulos de nexo_sync por categoría buscando esa subcadena, así que este
// código cae solo en la categoría "Matrículas" junto a sus hermanos.
// Uso: node database/seeds/seedSyncNovedadesSubmodule.js

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

const MODULE = { code: 'nexo_sync', name: 'Nexo' };
const NEW_SUBMODULE = { code: 'sync_enrollments_novedades', name: 'Novedades' };
const ALSO_GRANT_CODES = ['sync_preview_enrollments', 'sync_enrollments'];
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

async function findSubmoduleId(code) {
    const result = await pool.query(`SELECT id FROM ${schema}.submodules WHERE code = $1 LIMIT 1`, [code]);
    return result.rows.length > 0 ? result.rows[0].id : null;
}

async function ensureGrant(roleId, submoduleId, submoduleCode) {
    if (!submoduleId) {
        console.warn(`  Submódulo '${submoduleCode}' no existe todavía, se omite el grant`);
        return;
    }
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
    console.log(`Sembrando submódulo '${NEW_SUBMODULE.code}' en schema '${schema}'...`);

    const roleResult = await pool.query(
        `SELECT id FROM ${schema}.roles WHERE name = $1 LIMIT 1`,
        [GRANTED_ROLE_NAME]
    );
    if (roleResult.rows.length === 0) {
        throw new Error(`No existe el rol '${GRANTED_ROLE_NAME}' — no se puede otorgar acceso inicial`);
    }
    const superadminRoleId = roleResult.rows[0].id;

    const moduleId = await ensureModule();

    const newSubmoduleId = await ensureSubmodule(moduleId, NEW_SUBMODULE);
    await ensureGrant(superadminRoleId, newSubmoduleId, NEW_SUBMODULE.code);

    for (const code of ALSO_GRANT_CODES) {
        const submoduleId = await findSubmoduleId(code);
        await ensureGrant(superadminRoleId, submoduleId, code);
    }

    console.log('Listo.');
}

main()
    .catch((err) => {
        console.error('Error sembrando el submódulo sync_enrollments_novedades:', err.message);
        process.exitCode = 1;
    })
    .finally(() => pool.end());
