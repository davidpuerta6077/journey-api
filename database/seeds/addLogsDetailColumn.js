// Agrega la columna detail (JSONB) a logs: guarda la lista de items afectados
// por una acción en bloque (ej. usuarios matriculados, cursos enviados por
// SICAU) para que el front pueda mostrarla en un desplegable, sin tener que
// meter esa información en el texto de description.
// Idempotente: ADD COLUMN IF NOT EXISTS no falla si ya existe.
// Uso: node database/seeds/addLogsDetailColumn.js

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
    console.log(`Agregando columna detail a ${schema}.logs (si no existe)...`);
    await pool.query(`ALTER TABLE ${schema}.logs ADD COLUMN IF NOT EXISTS detail JSONB`);
    console.log('Listo.');
}

main()
    .catch((err) => {
        console.error('Error agregando detail a logs:', err.message);
        process.exitCode = 1;
    })
    .finally(() => pool.end());
