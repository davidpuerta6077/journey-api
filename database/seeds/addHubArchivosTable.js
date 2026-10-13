// Logo y favicon del hub guardados en la BD (bytea): el disco del contenedor
// (App Runner) no persiste entre despliegues. Una fila por clave. Idempotente.
// Uso: node database/seeds/addHubArchivosTable.js

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
    console.log(`Creando hub_archivos en schema '${schema}'...`);
    await pool.query(`
        CREATE TABLE IF NOT EXISTS ${schema}.hub_archivos (
            clave       TEXT PRIMARY KEY,
            mime        TEXT NOT NULL,
            datos       BYTEA NOT NULL,
            updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_by  TEXT
        )`);
    console.log('Listo.');
}

main()
    .catch((err) => {
        console.error('Error creando hub_archivos:', err.message);
        process.exitCode = 1;
    })
    .finally(() => pool.end());
