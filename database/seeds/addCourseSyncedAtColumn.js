// Agrega la columna synced_at a courses (fecha en que se sincronizó con Moodle,
// distinta de created_at que es cuando se recibió/creó el registro desde SICAU).
// Idempotente: ADD COLUMN IF NOT EXISTS no falla si ya existe.
// Uso: node database/seeds/addCourseSyncedAtColumn.js

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
    console.log(`Agregando columna synced_at a ${schema}.courses (si no existe)...`);
    await pool.query(`ALTER TABLE ${schema}.courses ADD COLUMN IF NOT EXISTS synced_at TIMESTAMP`);
    console.log('Listo.');
}

main()
    .catch((err) => {
        console.error('Error agregando synced_at:', err.message);
        process.exitCode = 1;
    })
    .finally(() => pool.end());
