// Reasigna los submódulos Integración, Reportes, Estadísticas y Configuración
// (antes agrupados bajo "Journey Sync") al módulo "Administrador" (code: admin).
// Idempotente: si un submódulo ya pertenece al módulo admin, no hace nada.
// Uso: node database/seeds/moveIntegrationReportsToAdmin.js

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

const TARGET_MODULE_CODE = 'admin';
const SUBMODULE_CODES = ['integration_apis', 'reports', 'statistics', 'settings'];

async function main() {
    console.log(`Reasignando submódulos al módulo '${TARGET_MODULE_CODE}' en schema '${schema}'...`);

    const moduleResult = await pool.query(
        `SELECT id FROM ${schema}.modules WHERE code = $1 LIMIT 1`,
        [TARGET_MODULE_CODE]
    );
    if (moduleResult.rows.length === 0) {
        throw new Error(`No existe el módulo '${TARGET_MODULE_CODE}'`);
    }
    const targetModuleId = moduleResult.rows[0].id;

    for (const code of SUBMODULE_CODES) {
        const existing = await pool.query(
            `SELECT id, module_id FROM ${schema}.submodules WHERE code = $1 LIMIT 1`,
            [code]
        );
        if (existing.rows.length === 0) {
            console.log(`  Submódulo '${code}' no existe, se omite`);
            continue;
        }
        const { id, module_id } = existing.rows[0];
        if (module_id === targetModuleId) {
            console.log(`  Submódulo '${code}' ya pertenece al módulo '${TARGET_MODULE_CODE}'`);
            continue;
        }
        await pool.query(
            `UPDATE ${schema}.submodules SET module_id = $1 WHERE id = $2`,
            [targetModuleId, id]
        );
        console.log(`  Submódulo '${code}' movido al módulo '${TARGET_MODULE_CODE}'`);
    }

    console.log('Listo.');
}

main()
    .catch((err) => {
        console.error('Error reasignando submódulos:', err.message);
        process.exitCode = 1;
    })
    .finally(() => pool.end());
