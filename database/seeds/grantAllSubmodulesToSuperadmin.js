// Auditoría + corrección: el rol superadmin debe tener TODOS los submódulos
// existentes otorgados (es el caso que detectó el bug de /busqueda -- el
// submódulo 'search' nunca se le había otorgado). Idempotente: solo inserta
// los que falten, no toca los que ya tiene.
// Uso: node database/seeds/grantAllSubmodulesToSuperadmin.js

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

const ROLE_NAME = 'superadmin';

async function main() {
    console.log(`Revisando permisos del rol '${ROLE_NAME}' en schema '${schema}'...`);

    const roleResult = await pool.query(`SELECT id FROM ${schema}.roles WHERE name = $1 LIMIT 1`, [ROLE_NAME]);
    if (roleResult.rows.length === 0) {
        throw new Error(`No existe el rol '${ROLE_NAME}'`);
    }
    const roleId = roleResult.rows[0].id;

    const allSubmodules = await pool.query(
        `SELECT s.id, s.code, s.name, m.code AS module_code, m.name AS module_name
         FROM ${schema}.submodules s
         JOIN ${schema}.modules m ON m.id = s.module_id
         ORDER BY m.name, s.name`
    );

    const granted = await pool.query(
        `SELECT submodule_id FROM ${schema}.role_permissions WHERE role_id = $1`,
        [roleId]
    );
    const grantedIds = new Set(granted.rows.map(r => r.submodule_id));

    const faltantes = allSubmodules.rows.filter(s => !grantedIds.has(s.id));

    if (faltantes.length === 0) {
        console.log(`'${ROLE_NAME}' ya tiene los ${allSubmodules.rows.length} submódulos existentes. Nada que hacer.`);
        return;
    }

    for (const s of faltantes) {
        await pool.query(
            `INSERT INTO ${schema}.role_permissions (role_id, submodule_id) VALUES ($1, $2)`,
            [roleId, s.id]
        );
        console.log(`  + Otorgado: ${s.module_name} > ${s.name} (${s.module_code}::${s.code})`);
    }

    console.log(`Listo. ${faltantes.length} submódulo(s) otorgado(s) de ${allSubmodules.rows.length} totales.`);
}

main()
    .catch((err) => {
        console.error('Error otorgando submódulos a superadmin:', err.message);
        process.exitCode = 1;
    })
    .finally(() => pool.end());
