// Agrega a users las columnas para la novedad de usuarios reportados por SICAU:
// correo_pendiente (correo nuevo propuesto, esperando decisión humana porque el
// correo es el username en Moodle y no se pisa solo) y novedad_datos (último
// cambio no-correo ya aplicado automáticamente, solo para mostrarlo en Sync >
// Usuarios). Idempotente. Uso: node database/seeds/addUserNovedadColumns.js

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
    await pool.query(`ALTER TABLE ${schema}.users ADD COLUMN IF NOT EXISTS correo_pendiente TEXT`);
    await pool.query(`ALTER TABLE ${schema}.users ADD COLUMN IF NOT EXISTS novedad_datos JSONB`);
    console.log(`Columnas correo_pendiente/novedad_datos listas en ${schema}.users.`);
}

main()
    .catch((err) => {
        console.error('Error agregando columnas de novedad de usuarios:', err.message);
        process.exitCode = 1;
    })
    .finally(() => pool.end());
