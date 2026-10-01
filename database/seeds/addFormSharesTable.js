// Crea la tabla form_shares: formularios compartidos con otros usuarios de
// plataforma (pueden ver inscritos y exportar, pero no editar). Idempotente.
// Uso: node database/seeds/addFormSharesTable.js

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
    await pool.query(`
        CREATE TABLE IF NOT EXISTS ${schema}.form_shares (
            id          SERIAL PRIMARY KEY,
            form_id     INTEGER NOT NULL REFERENCES ${schema}.forms(id) ON DELETE CASCADE,
            user_id     INTEGER NOT NULL,
            created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);
    await pool.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS form_shares_form_user_idx
        ON ${schema}.form_shares (form_id, user_id)
    `);
    console.log(`Tabla ${schema}.form_shares lista.`);
}

main()
    .catch((err) => {
        console.error('Error creando form_shares:', err.message);
        process.exitCode = 1;
    })
    .finally(() => pool.end());
