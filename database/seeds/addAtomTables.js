// Tablas del módulo Atom (gestión de tareas, widget en el Index del Hub).
// Idempotente. Uso: node database/seeds/addAtomTables.js

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
    console.log(`Creando tablas de Atom en schema '${schema}'...`);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS ${schema}.atom_tasks (
            id            SERIAL PRIMARY KEY,
            title         TEXT NOT NULL,
            description   TEXT,
            priority      TEXT NOT NULL DEFAULT 'Media',
            status        TEXT NOT NULL DEFAULT 'Pendiente',
            category      TEXT,
            due_date      DATE,
            created_by    INTEGER NOT NULL REFERENCES ${schema}.platform_users(id),
            assigned_to   INTEGER REFERENCES ${schema}.platform_users(id),
            created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
            completed_at  TIMESTAMPTZ
        )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS atom_tasks_created_by_idx  ON ${schema}.atom_tasks (created_by)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS atom_tasks_assigned_to_idx ON ${schema}.atom_tasks (assigned_to)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS atom_tasks_status_idx      ON ${schema}.atom_tasks (status)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS atom_tasks_due_date_idx    ON ${schema}.atom_tasks (due_date)`);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS ${schema}.atom_subtasks (
            id       SERIAL PRIMARY KEY,
            task_id  INTEGER NOT NULL REFERENCES ${schema}.atom_tasks(id) ON DELETE CASCADE,
            title    TEXT NOT NULL,
            done     BOOLEAN NOT NULL DEFAULT false,
            orden    INTEGER NOT NULL DEFAULT 0
        )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS atom_subtasks_task_idx ON ${schema}.atom_subtasks (task_id)`);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS ${schema}.atom_task_comments (
            id                SERIAL PRIMARY KEY,
            task_id           INTEGER NOT NULL REFERENCES ${schema}.atom_tasks(id) ON DELETE CASCADE,
            platform_user_id  INTEGER NOT NULL REFERENCES ${schema}.platform_users(id),
            body              TEXT NOT NULL,
            created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS atom_task_comments_task_idx ON ${schema}.atom_task_comments (task_id)`);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS ${schema}.atom_task_history (
            id                SERIAL PRIMARY KEY,
            task_id           INTEGER NOT NULL REFERENCES ${schema}.atom_tasks(id) ON DELETE CASCADE,
            platform_user_id  INTEGER REFERENCES ${schema}.platform_users(id),
            campo             TEXT NOT NULL,
            anterior          TEXT,
            actual            TEXT,
            created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS atom_task_history_task_idx ON ${schema}.atom_task_history (task_id)`);

    console.log('Listo.');
}

main()
    .catch((err) => {
        console.error('Error creando tablas de Atom:', err.message);
        process.exitCode = 1;
    })
    .finally(() => pool.end());
