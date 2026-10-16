// Imágenes de evidencia del módulo Informes guardadas en la BD (bytea): el
// disco del contenedor (App Runner) no persiste entre despliegues ni se
// comparte entre instancias. Idempotente.
// Uso: node database/seeds/addOnixArchivosTable.js

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
    console.log(`Creando onix_archivos en schema '${schema}'...`);
    await pool.query(`
        CREATE TABLE IF NOT EXISTS ${schema}.onix_archivos (
            id          SERIAL PRIMARY KEY,
            user_id     INTEGER NOT NULL REFERENCES ${schema}.platform_users(id) ON DELETE CASCADE,
            mime        TEXT NOT NULL,
            datos       BYTEA NOT NULL,
            created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
        )`);
    console.log('Listo.');
}

main()
    .catch((err) => {
        console.error('Error creando onix_archivos:', err.message);
        process.exitCode = 1;
    })
    .finally(() => pool.end());
