// Crea las tablas de Asignia (programación académica y postulaciones de
// profesores): asignia_cursos y asignia_postulaciones. Idempotente.
// Uso: node database/seeds/addAsigniaTables.js

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
    // verificacion: vacio | asignado | aceptado | rechazado | postulado
    await pool.query(`
        CREATE TABLE IF NOT EXISTS ${schema}.asignia_cursos (
            id                  SERIAL PRIMARY KEY,
            periodo             TEXT NOT NULL,
            sede                TEXT NOT NULL DEFAULT '',
            programa            TEXT NOT NULL DEFAULT '',
            plan                TEXT NOT NULL DEFAULT '',
            nivel               TEXT NOT NULL DEFAULT '',
            codigo              TEXT NOT NULL,
            curso               TEXT NOT NULL,
            grupo               TEXT NOT NULL DEFAULT '',
            agrupamiento        TEXT NOT NULL DEFAULT '',
            creditos            TEXT NOT NULL DEFAULT '',
            horas_semana        TEXT NOT NULL DEFAULT '',
            espacio             TEXT NOT NULL DEFAULT '',
            jornada             TEXT NOT NULL DEFAULT '',
            horario             JSONB NOT NULL DEFAULT '[]'::jsonb,
            profesor_nombre     TEXT NOT NULL DEFAULT '',
            profesor_documento  TEXT NOT NULL DEFAULT '',
            profesor_correo     TEXT NOT NULL DEFAULT '',
            vinculacion         TEXT NOT NULL DEFAULT '',
            verificacion        TEXT NOT NULL DEFAULT 'vacio'
                CHECK (verificacion IN ('vacio', 'asignado', 'aceptado', 'rechazado', 'postulado')),
            motivo_rechazo      TEXT,
            verificado_at       TIMESTAMPTZ,
            created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);
    // Una fila de la programación = un grupo de un curso en una sede/programa/plan/jornada.
    await pool.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS asignia_cursos_clave_idx
        ON ${schema}.asignia_cursos (periodo, sede, programa, plan, codigo, grupo, agrupamiento, jornada)
    `);
    await pool.query(`
        CREATE INDEX IF NOT EXISTS asignia_cursos_profesor_idx
        ON ${schema}.asignia_cursos (profesor_documento)
    `);

    // estado: pendiente | aprobada | descartada | rechazada
    await pool.query(`
        CREATE TABLE IF NOT EXISTS ${schema}.asignia_postulaciones (
            id          SERIAL PRIMARY KEY,
            curso_id    INTEGER NOT NULL REFERENCES ${schema}.asignia_cursos(id) ON DELETE CASCADE,
            documento   TEXT NOT NULL,
            correo      TEXT NOT NULL,
            nombre      TEXT NOT NULL,
            estado      TEXT NOT NULL DEFAULT 'pendiente'
                CHECK (estado IN ('pendiente', 'aprobada', 'descartada')),
            created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);
    // 'rechazada': el líder rechazó la postulación (agregado después de crear la tabla).
    await pool.query(`
        ALTER TABLE ${schema}.asignia_postulaciones DROP CONSTRAINT IF EXISTS asignia_postulaciones_estado_check;
        ALTER TABLE ${schema}.asignia_postulaciones ADD CONSTRAINT asignia_postulaciones_estado_check
            CHECK (estado IN ('pendiente', 'aprobada', 'descartada', 'rechazada'));
    `);
    await pool.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS asignia_postulaciones_curso_doc_idx
        ON ${schema}.asignia_postulaciones (curso_id, documento)
    `);

    // Base de profesores (pestaña "BD Profesores"): permite entrar a la pantalla
    // pública a profesores que no tienen cursos en la programación.
    await pool.query(`
        CREATE TABLE IF NOT EXISTS ${schema}.asignia_profesores (
            id          SERIAL PRIMARY KEY,
            documento   TEXT NOT NULL UNIQUE,
            nombre      TEXT NOT NULL,
            correo      TEXT NOT NULL DEFAULT '',
            vinculacion TEXT NOT NULL DEFAULT '',
            created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);

    console.log(`Tablas de Asignia listas en schema '${schema}'.`);
}

main()
    .catch((err) => {
        console.error('Error creando tablas de Asignia:', err.message);
        process.exitCode = 1;
    })
    .finally(() => pool.end());
