// Crea la tabla sicau_novedades: registro de las novedades que SICAU manda ya
// calculadas (CAMBIO_DE_GRUPO, CAMBIO_DE_ESTADO, RETIRO de curso...). Nexo
// sigue decidiendo por `estado`; esta tabla solo guarda lo que reportó SICAU
// para mostrarlo en Sync > Novedades > "Reportadas por SICAU".
// Idempotente. Uso: node database/seeds/addSicauNovedadesTable.js

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
        CREATE TABLE IF NOT EXISTS ${schema}.sicau_novedades (
            id                SERIAL PRIMARY KEY,
            fecha             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            nivel             TEXT NOT NULL,
            tipo              TEXT,
            motivo            TEXT,
            codigo_journey    TEXT,
            codigo_asignatura TEXT,
            nombre_asignatura TEXT,
            periodo           TEXT,
            grupo             TEXT,
            cedula            TEXT,
            cambios           JSONB NOT NULL DEFAULT '[]'::jsonb,
            usuario_sicau     TEXT,
            resultado         TEXT
        )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS sicau_novedades_fecha_idx ON ${schema}.sicau_novedades (fecha DESC)`);
    console.log(`Tabla ${schema}.sicau_novedades lista.`);
}

main()
    .catch((err) => {
        console.error('Error creando sicau_novedades:', err.message);
        process.exitCode = 1;
    })
    .finally(() => pool.end());
