// Subactividades de Informes (onix_registros): título, párrafo para el
// documento de la actividad y documento de evidencia generados con IA.
// Los registros anteriores quedan con titulo NULL (se usa la primera línea del
// texto). Idempotente.
// Uso: node database/seeds/addOnixSubactividades.js

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
    console.log(`Agregando columnas de subactividades a onix_registros en schema '${schema}'...`);
    await pool.query(`
        ALTER TABLE ${schema}.onix_registros
            ADD COLUMN IF NOT EXISTS titulo      TEXT,
            ADD COLUMN IF NOT EXISTS parrafo     TEXT,
            ADD COLUMN IF NOT EXISTS documento   JSONB,
            ADD COLUMN IF NOT EXISTS proveedor   TEXT,
            ADD COLUMN IF NOT EXISTS modelo      TEXT,
            ADD COLUMN IF NOT EXISTS generado_at TIMESTAMPTZ`);
    console.log('Listo.');
}

main()
    .catch((err) => {
        console.error('Error agregando columnas de subactividades:', err.message);
        process.exitCode = 1;
    })
    .finally(() => pool.end());
