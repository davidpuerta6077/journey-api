// Crea las tablas del módulo Informes (Onix-IA). Idempotente.
// Uso: node database/seeds/addOnixReportsTables.js

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
    console.log(`Creando tablas onix_* en schema '${schema}'...`);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS ${schema}.onix_areas (
            id          SERIAL PRIMARY KEY,
            nombre      TEXT NOT NULL UNIQUE,
            color       TEXT NOT NULL DEFAULT '#19445e',
            created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
        )`);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS ${schema}.onix_perfiles (
            user_id         INTEGER PRIMARY KEY REFERENCES ${schema}.platform_users(id) ON DELETE CASCADE,
            nombre          TEXT NOT NULL,
            identificacion  TEXT NOT NULL,
            area_id         INTEGER REFERENCES ${schema}.onix_areas(id) ON DELETE SET NULL,
            contrato        TEXT,
            objeto          TEXT,
            updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
        )`);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS ${schema}.onix_actividades (
            id           SERIAL PRIMARY KEY,
            user_id      INTEGER NOT NULL REFERENCES ${schema}.platform_users(id) ON DELETE CASCADE,
            nombre       TEXT NOT NULL,
            descripcion  TEXT NOT NULL,
            orden        INTEGER NOT NULL DEFAULT 0,
            created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
        )`);
    await pool.query(`CREATE INDEX IF NOT EXISTS onix_actividades_user_idx ON ${schema}.onix_actividades(user_id)`);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS ${schema}.onix_registros (
            id            SERIAL PRIMARY KEY,
            actividad_id  INTEGER NOT NULL REFERENCES ${schema}.onix_actividades(id) ON DELETE CASCADE,
            user_id       INTEGER NOT NULL REFERENCES ${schema}.platform_users(id) ON DELETE CASCADE,
            mes           SMALLINT NOT NULL CHECK (mes BETWEEN 1 AND 12),
            anio          SMALLINT NOT NULL,
            desarrollo    TEXT NOT NULL,
            created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
        )`);
    await pool.query(`CREATE INDEX IF NOT EXISTS onix_registros_periodo_idx ON ${schema}.onix_registros(actividad_id, anio, mes)`);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS ${schema}.onix_evidencias (
            id           SERIAL PRIMARY KEY,
            registro_id  INTEGER NOT NULL REFERENCES ${schema}.onix_registros(id) ON DELETE CASCADE,
            tipo         TEXT NOT NULL CHECK (tipo IN ('texto', 'link', 'imagen')),
            contenido    TEXT NOT NULL,
            descripcion  TEXT,
            created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
        )`);
    await pool.query(`CREATE INDEX IF NOT EXISTS onix_evidencias_registro_idx ON ${schema}.onix_evidencias(registro_id)`);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS ${schema}.onix_informes (
            id            SERIAL PRIMARY KEY,
            user_id       INTEGER NOT NULL REFERENCES ${schema}.platform_users(id) ON DELETE CASCADE,
            actividad_id  INTEGER NOT NULL REFERENCES ${schema}.onix_actividades(id) ON DELETE CASCADE,
            mes           SMALLINT NOT NULL CHECK (mes BETWEEN 1 AND 12),
            anio          SMALLINT NOT NULL,
            desarrollo    TEXT NOT NULL,
            proveedor     TEXT NOT NULL,
            modelo        TEXT NOT NULL,
            generado_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
            editado_at    TIMESTAMPTZ,
            UNIQUE (actividad_id, mes, anio)
        )`);

    console.log('Listo.');
}

main()
    .catch((err) => {
        console.error('Error creando tablas onix_*:', err.message);
        process.exitCode = 1;
    })
    .finally(() => pool.end());
