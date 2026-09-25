// El código dejó de escribir estado='Eliminado' en enrollments (ahora escribe
// 'Desmatriculado', ver deleteElement y processExcelAndSuspendUsers en
// api/enrollments/controller.js) para que el texto sea consistente con lo que
// realmente hace esa acción: no borra la fila, solo desmatricula. Este script
// pone al día las filas históricas que ya habían quedado con el valor viejo.
// `estado` es texto libre (sin catálogo/enum ni FK), así que el rename es un
// UPDATE directo y no rompe nada más.
// Idempotente: si no quedan filas con 'Eliminado' no hace nada.
// Uso: node database/seeds/renameEliminadoToDesmatriculado.js

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
    console.log(`Renombrando estado 'Eliminado' -> 'Desmatriculado' en ${schema}.enrollments...`);
    const result = await pool.query(`
        UPDATE ${schema}.enrollments
        SET estado = 'Desmatriculado'
        WHERE lower(trim(estado)) = 'eliminado'
    `);
    console.log(`Listo. ${result.rowCount} fila(s) actualizada(s).`);
}

main()
    .catch((err) => {
        console.error('Error renombrando estado:', err.message);
        process.exitCode = 1;
    })
    .finally(() => pool.end());
