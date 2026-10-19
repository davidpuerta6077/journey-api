// Páginas del editor CodeX (antes Moodle Content Builder, que guardaba en
// localStorage): una fila por página, de un usuario de Bravo Hub. Idempotente.
// Uso: node database/seeds/addCodexPagesTable.js

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
    console.log(`Creando codex_pages en schema '${schema}'...`);
    await pool.query(`
        CREATE TABLE IF NOT EXISTS ${schema}.codex_pages (
            id                SERIAL PRIMARY KEY,
            platform_user_id  INTEGER NOT NULL REFERENCES ${schema}.platform_users(id) ON DELETE CASCADE,
            nombre            TEXT NOT NULL,
            bloques           JSONB NOT NULL DEFAULT '[]'::jsonb,
            created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
        )`);
    await pool.query(`
        CREATE INDEX IF NOT EXISTS codex_pages_user_updated_idx
        ON ${schema}.codex_pages (platform_user_id, updated_at DESC)`);
    console.log('Listo.');
}

main()
    .catch((err) => {
        console.error('Error creando codex_pages:', err.message);
        process.exitCode = 1;
    })
    .finally(() => pool.end());
