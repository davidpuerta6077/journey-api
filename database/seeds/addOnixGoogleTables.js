// Google Calendar en Informes (Onix-IA): la cuenta de Google conectada por
// cada usuario (refresh token cifrado) y los eventos ya usados en una
// subactividad, para no ofrecerlos dos veces. Idempotente.
// Uso: node database/seeds/addOnixGoogleTables.js

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
    console.log(`Creando tablas de Google Calendar de Informes en schema '${schema}'...`);
    await pool.query(`
        CREATE TABLE IF NOT EXISTS ${schema}.onix_google (
            user_id        INTEGER PRIMARY KEY REFERENCES ${schema}.platform_users(id) ON DELETE CASCADE,
            email          TEXT NOT NULL,
            refresh_token  JSONB NOT NULL,
            connected_at   TIMESTAMPTZ NOT NULL DEFAULT now()
        )`);
    await pool.query(`
        CREATE TABLE IF NOT EXISTS ${schema}.onix_registro_eventos (
            registro_id  INTEGER NOT NULL REFERENCES ${schema}.onix_registros(id) ON DELETE CASCADE,
            user_id      INTEGER NOT NULL REFERENCES ${schema}.platform_users(id) ON DELETE CASCADE,
            evento_id    TEXT NOT NULL,
            PRIMARY KEY (user_id, evento_id)
        )`);
    console.log('Listo.');
}

main()
    .catch((err) => {
        console.error('Error creando tablas de Google Calendar:', err.message);
        process.exitCode = 1;
    })
    .finally(() => pool.end());
