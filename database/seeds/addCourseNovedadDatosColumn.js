// Agrega a courses la columna novedad_datos: el último cambio de metadata
// (profesor, fechas) que SICAU reportó para ese curso, mismo patrón que
// users.novedad_datos (ver addUserNovedadColumns.js), para mostrarlo en la
// fila expandida de Módulo Cursos igual que ya se ve en Sync > Usuarios.
// Idempotente. Uso: node database/seeds/addCourseNovedadDatosColumn.js

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
    await pool.query(`ALTER TABLE ${schema}.courses ADD COLUMN IF NOT EXISTS novedad_datos JSONB`);
    console.log(`Columna novedad_datos lista en ${schema}.courses.`);
}

main()
    .catch((err) => {
        console.error('Error agregando columna novedad_datos a courses:', err.message);
        process.exitCode = 1;
    })
    .finally(() => pool.end());
