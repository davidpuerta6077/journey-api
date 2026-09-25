// Agrega estado_anterior/fecha_cambio_estado a enrollments: cada vez que el
// estado académico de una matrícula cambia (updateEnrollmentEstadoQuery en
// querysets.js) se guarda de dónde venía y cuándo, para que el módulo
// Sync > Novedades pueda mostrar historial de cambios (traslados,
// cancelaciones, retiros) en vez de solo el estado actual.
// Idempotente: ADD COLUMN IF NOT EXISTS no falla si ya existe.
// Uso: node database/seeds/addEnrollmentEstadoAnteriorColumn.js

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
    console.log(`Agregando estado_anterior/fecha_cambio_estado a ${schema}.enrollments (si no existen)...`);
    await pool.query(`ALTER TABLE ${schema}.enrollments ADD COLUMN IF NOT EXISTS estado_anterior TEXT`);
    await pool.query(`ALTER TABLE ${schema}.enrollments ADD COLUMN IF NOT EXISTS fecha_cambio_estado TIMESTAMP`);
    console.log('Listo.');
}

main()
    .catch((err) => {
        console.error('Error agregando estado_anterior/fecha_cambio_estado:', err.message);
        process.exitCode = 1;
    })
    .finally(() => pool.end());
