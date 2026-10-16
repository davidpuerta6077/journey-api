// Crea las tablas notifications y notification_recipients: notificaciones
// in-app (ej. "llegó una novedad de SICAU") con fan-out por usuario, para
// que cada platform_user tenga su propio estado leído/no leído.
// Idempotente. Uso: node database/seeds/addNotificationsTable.js

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
        CREATE TABLE IF NOT EXISTS ${schema}.notifications (
            id          SERIAL PRIMARY KEY,
            created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            type        TEXT NOT NULL,
            title       TEXT NOT NULL,
            body        TEXT,
            entity_type TEXT,
            entity_id   INTEGER,
            link        TEXT,
            detail      JSONB
        )
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS ${schema}.notification_recipients (
            id               SERIAL PRIMARY KEY,
            notification_id  INTEGER NOT NULL REFERENCES ${schema}.notifications(id) ON DELETE CASCADE,
            platform_user_id INTEGER NOT NULL REFERENCES ${schema}.platform_users(id) ON DELETE CASCADE,
            read_at          TIMESTAMPTZ,
            UNIQUE (notification_id, platform_user_id)
        )
    `);

    await pool.query(`CREATE INDEX IF NOT EXISTS notifications_created_at_idx ON ${schema}.notifications (created_at DESC)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS notification_recipients_unread_idx ON ${schema}.notification_recipients (platform_user_id) WHERE read_at IS NULL`);

    console.log(`Tablas ${schema}.notifications y ${schema}.notification_recipients listas.`);
}

main()
    .catch((err) => {
        console.error('Error creando notifications:', err.message);
        process.exitCode = 1;
    })
    .finally(() => pool.end());
