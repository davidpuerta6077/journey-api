// Crea la tabla `reports` (definiciones de reporte del módulo Reportes).
// Guarda solo la definición (nombre, tipo, parámetros); el resultado se calcula
// al vuelo en cada ejecución, no se hace snapshot.
// Idempotente: CREATE TABLE IF NOT EXISTS.
// Uso: node database/seeds/addReportsTable.js

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
    console.log(`Creando tabla ${schema}.reports (si no existe)...`);
    await pool.query(`
        CREATE TABLE IF NOT EXISTS ${schema}.reports (
            id          SERIAL PRIMARY KEY,
            nombre      TEXT NOT NULL,
            tipo        TEXT NOT NULL,
            params      JSONB NOT NULL DEFAULT '{}'::jsonb,
            descripcion TEXT,
            created_by  TEXT,
            created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    `);
    console.log('Listo.');
}

main()
    .catch((err) => {
        console.error('Error creando la tabla reports:', err.message);
        process.exitCode = 1;
    })
    .finally(() => pool.end());
