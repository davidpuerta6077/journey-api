// Agrega la columna photo_url a platform_users (para la foto de "Mi Perfil").
// Idempotente: ADD COLUMN IF NOT EXISTS no falla si ya existe.
// Uso: node database/seeds/addPlatformUserPhotoColumn.js

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
    console.log(`Agregando columna photo_url a ${schema}.platform_users (si no existe)...`);
    await pool.query(`ALTER TABLE ${schema}.platform_users ADD COLUMN IF NOT EXISTS photo_url TEXT`);
    console.log('Listo.');
}

main()
    .catch((err) => {
        console.error('Error agregando photo_url:', err.message);
        process.exitCode = 1;
    })
    .finally(() => pool.end());
