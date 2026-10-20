// Agrega fecha_nacimiento a platform_users (usuarios del Hub, no SICAU), para
// las notificaciones automáticas de cumpleaños. Idempotente.
// Uso: node database/seeds/addPlatformUserFechaNacimiento.js

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
    await pool.query(`ALTER TABLE ${schema}.platform_users ADD COLUMN IF NOT EXISTS fecha_nacimiento DATE`);
    console.log(`Columna fecha_nacimiento lista en ${schema}.platform_users.`);
}

main()
    .catch((err) => {
        console.error('Error agregando fecha_nacimiento:', err.message);
        process.exitCode = 1;
    })
    .finally(() => pool.end());
