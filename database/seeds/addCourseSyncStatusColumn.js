// Agrega estado_sync/ultimo_error_sync a courses para poder mostrar
// "Sincronizando" mientras Moodle procesa la duplicación (que puede tardar
// varios minutos con 10-15 copias de la misma semilla) y no solo
// "Pendiente"/"Sincronizado". Backfillea estado_sync a partir de la columna
// booleana `sincronizado` que ya existía.
// Idempotente: ADD COLUMN IF NOT EXISTS no falla si ya existe.
// Uso: node database/seeds/addCourseSyncStatusColumn.js

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
    console.log(`Agregando estado_sync/ultimo_error_sync a ${schema}.courses (si no existen)...`);
    await pool.query(`ALTER TABLE ${schema}.courses ADD COLUMN IF NOT EXISTS estado_sync TEXT DEFAULT 'pendiente'`);
    await pool.query(`ALTER TABLE ${schema}.courses ADD COLUMN IF NOT EXISTS ultimo_error_sync TEXT`);

    // ADD COLUMN ... DEFAULT ya deja estado_sync = 'pendiente' en todas las filas
    // existentes (no queda NULL), así que el backfill no puede filtrar por
    // "IS NULL": hay que corregir explícitamente las que ya estaban sincronizadas.
    console.log('Backfill de estado_sync a partir de sincronizado/moodle_id...');
    await pool.query(`
        UPDATE ${schema}.courses
        SET estado_sync = 'sincronizado'
        WHERE sincronizado = true AND estado_sync != 'sincronizado'
    `);
    console.log('Listo.');
}

main()
    .catch((err) => {
        console.error('Error agregando estado_sync/ultimo_error_sync:', err.message);
        process.exitCode = 1;
    })
    .finally(() => pool.end());
