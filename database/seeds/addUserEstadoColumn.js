// Agrega a users la columna estado (estado académico del estudiante que manda
// SICAU: "Matriculado", "Retirado", "Cancelado"... mismo catálogo que
// enrollments.estado, ver ESTADOS_MATRICULA en services/normalize.js). Arranca
// en "Matriculado" para las filas existentes porque es el estado por defecto
// con el que journey siempre recibió a un estudiante hasta ahora.
// Idempotente. Uso: node database/seeds/addUserEstadoColumn.js

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
    await pool.query(`ALTER TABLE ${schema}.users ADD COLUMN IF NOT EXISTS estado TEXT DEFAULT 'Matriculado'`);
    await pool.query(`UPDATE ${schema}.users SET estado = 'Matriculado' WHERE estado IS NULL`);
    console.log(`Columna estado lista en ${schema}.users.`);
}

main()
    .catch((err) => {
        console.error('Error agregando columna estado a users:', err.message);
        process.exitCode = 1;
    })
    .finally(() => pool.end());
