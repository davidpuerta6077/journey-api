// Actualiza los `code` de modules/submodules que quedaron desalineados tras el
// rebrand (SIDEM->Visor, Moodle Builder->CodeX, Journey->Nexo en el frontend).
// Sin este update, los permisos otorgados sobre el code viejo dejan de matchear
// con el moduleCode nuevo que envía journey-front y el usuario pierde acceso.
// Idempotente: usa UPDATE ... WHERE code = viejo, no falla si ya se corrió antes
// (la segunda vez simplemente no actualiza ninguna fila).
// Uso: node database/seeds/renameModuleCodesBrand.js

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

const RENAMES = [
    { old: 'sidem',         new: 'visor' },
    { old: 'moodle_builder', new: 'codex' },
    { old: 'journey_sync',  new: 'nexo_sync' },
    { old: 'journey_home',  new: 'nexo_home' },
];

async function renameCode(table, oldCode, newCode) {
    const result = await pool.query(
        `UPDATE ${schema}.${table} SET code = $1 WHERE code = $2`,
        [newCode, oldCode]
    );
    if (result.rowCount > 0) {
        console.log(`  ${table}: '${oldCode}' -> '${newCode}' (${result.rowCount} fila(s))`);
    }
}

async function main() {
    console.log(`Renombrando codes de modules/submodules en schema '${schema}'...`);
    for (const { old, new: next } of RENAMES) {
        await renameCode('modules', old, next);
        await renameCode('submodules', old, next);
    }
    console.log('Listo.');
}

main()
    .catch((err) => {
        console.error('Error renombrando codes:', err.message);
        process.exitCode = 1;
    })
    .finally(() => pool.end());
