// Relación registro de informe ↔ acciones del usuario en Bravo Hub (logs).
// Un registro puede agrupar varias acciones; cada acción se usa una sola vez
// (índice único en log_id). Borrar el registro libera sus acciones. Idempotente.
// Uso: node database/seeds/addOnixRegistroLogsTable.js

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

async function main() {
    console.log(`Creando onix_registro_logs en schema '${schema}'...`);
    await pool.query(`
        CREATE TABLE IF NOT EXISTS ${schema}.onix_registro_logs (
            registro_id  INTEGER NOT NULL REFERENCES ${schema}.onix_registros(id) ON DELETE CASCADE,
            log_id       INTEGER NOT NULL REFERENCES ${schema}.logs(id) ON DELETE CASCADE,
            PRIMARY KEY (registro_id, log_id)
        )`);
    await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS onix_registro_logs_log_uniq ON ${schema}.onix_registro_logs(log_id)`);
    console.log('Listo.');
}

main()
    .catch((err) => {
        console.error('Error creando onix_registro_logs:', err.message);
        process.exitCode = 1;
    })
    .finally(() => pool.end());
