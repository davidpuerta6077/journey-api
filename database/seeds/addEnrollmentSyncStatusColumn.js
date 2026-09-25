// Agrega estado_sync/ultimo_error_sync a enrollments, con el mismo propósito
// que ya tienen en courses (ver addCourseSyncStatusColumn.js): poder marcar
// una matrícula como "novedad" (el estudiante cambió de curso vía SICAU y hay
// que revisarla) o "error" con el detalle de Moodle, y no solo depender del
// booleano `sincronizado`.
// Idempotente: ADD COLUMN IF NOT EXISTS no falla si ya existe.
// Uso: node database/seeds/addEnrollmentSyncStatusColumn.js

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
    console.log(`Agregando estado_sync/ultimo_error_sync a ${schema}.enrollments (si no existen)...`);
    await pool.query(`ALTER TABLE ${schema}.enrollments ADD COLUMN IF NOT EXISTS estado_sync TEXT DEFAULT 'pendiente'`);
    await pool.query(`ALTER TABLE ${schema}.enrollments ADD COLUMN IF NOT EXISTS ultimo_error_sync TEXT`);

    // ADD COLUMN ... DEFAULT ya deja estado_sync = 'pendiente' en todas las filas
    // existentes (no queda NULL), así que el backfill no puede filtrar por
    // "IS NULL": hay que corregir explícitamente las que ya estaban sincronizadas.
    console.log('Backfill de estado_sync a partir de sincronizado...');
    await pool.query(`
        UPDATE ${schema}.enrollments
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
