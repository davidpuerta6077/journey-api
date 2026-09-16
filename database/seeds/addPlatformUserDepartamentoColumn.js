// Agrega la columna departamento a platform_users (para "Mi Perfil" / Admin de usuarios).
// Idempotente: ADD COLUMN IF NOT EXISTS no falla si ya existe.
// Uso: node database/seeds/addPlatformUserDepartamentoColumn.js

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
    console.log(`Agregando columna departamento a ${schema}.platform_users (si no existe)...`);
    await pool.query(`ALTER TABLE ${schema}.platform_users ADD COLUMN IF NOT EXISTS departamento TEXT`);
    console.log('Listo.');
}

main()
    .catch((err) => {
        console.error('Error agregando departamento:', err.message);
        process.exitCode = 1;
    })
    .finally(() => pool.end());
