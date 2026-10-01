// Crea las tablas del módulo de Formularios de Asistencia: forms, form_questions,
// form_responses, form_answers. Idempotente.
// Uso: node database/seeds/addAttendanceFormsTables.js

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
        CREATE TABLE IF NOT EXISTS ${schema}.forms (
            id            SERIAL PRIMARY KEY,
            user_id       INTEGER NOT NULL,
            title         TEXT NOT NULL,
            description   TEXT,
            event_date    TIMESTAMPTZ,
            location      TEXT,
            modality      TEXT NOT NULL DEFAULT 'presencial',
            opens_at      TIMESTAMPTZ,
            closes_at     TIMESTAMPTZ,
            max_capacity  INTEGER,
            status        TEXT NOT NULL DEFAULT 'borrador',
            public_token  TEXT UNIQUE,
            created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            deleted_at    TIMESTAMPTZ
        )
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS ${schema}.form_questions (
            id          SERIAL PRIMARY KEY,
            form_id     INTEGER NOT NULL REFERENCES ${schema}.forms(id) ON DELETE CASCADE,
            label       TEXT NOT NULL,
            type        TEXT NOT NULL,
            options     JSONB,
            required    BOOLEAN NOT NULL DEFAULT false,
            help_text   TEXT,
            position    INTEGER NOT NULL DEFAULT 0,
            deleted_at  TIMESTAMPTZ
        )
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS ${schema}.form_responses (
            id            SERIAL PRIMARY KEY,
            form_id       INTEGER NOT NULL REFERENCES ${schema}.forms(id) ON DELETE CASCADE,
            identifier    TEXT NOT NULL,
            ip_address    TEXT,
            submitted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);
    await pool.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS form_responses_form_identifier_idx
        ON ${schema}.form_responses (form_id, identifier)
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS ${schema}.form_answers (
            id            SERIAL PRIMARY KEY,
            response_id   INTEGER NOT NULL REFERENCES ${schema}.form_responses(id) ON DELETE CASCADE,
            question_id   INTEGER NOT NULL REFERENCES ${schema}.form_questions(id) ON DELETE CASCADE,
            value         TEXT
        )
    `);

    console.log(`Tablas de formularios de asistencia listas en schema '${schema}'.`);
}

main()
    .catch((err) => {
        console.error('Error creando tablas de formularios de asistencia:', err.message);
        process.exitCode = 1;
    })
    .finally(() => pool.end());
