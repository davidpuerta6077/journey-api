// El código dejó de usar la columna `docente` de courses (ahora es
// `nombre_profesor`, para que quede consistente con el rótulo "Profesor:" que
// ya se usa en fullname y en Módulo Cursos/Sync Cursos) y de paso se agregan
// tres columnas nuevas para los datos de contacto del profesor que SICAU ya
// manda en el endpoint /sicau/send_courses_enrollments_sicau: documento,
// celular y correo_institucional.
// Idempotente: si `docente` ya no existe (o `nombre_profesor` ya existe) no
// intenta renombrar de nuevo; los ADD COLUMN usan IF NOT EXISTS.
// Uso: node database/seeds/renameDocenteToNombreProfesor.js

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
    console.log(`Actualizando ${schema}.courses (docente -> nombre_profesor + contacto del profesor)...`);

    const { rows } = await pool.query(`
        SELECT column_name FROM information_schema.columns
        WHERE table_schema = $1 AND table_name = 'courses' AND column_name IN ('docente', 'nombre_profesor')
    `, [schema]);
    const columnas = rows.map(r => r.column_name);

    if (columnas.includes('docente') && !columnas.includes('nombre_profesor')) {
        await pool.query(`ALTER TABLE ${schema}.courses RENAME COLUMN docente TO nombre_profesor`);
        console.log('  docente -> nombre_profesor renombrada.');
    } else {
        console.log('  Nada que renombrar (docente ya no existe o nombre_profesor ya existe).');
    }

    await pool.query(`ALTER TABLE ${schema}.courses ADD COLUMN IF NOT EXISTS documento TEXT`);
    await pool.query(`ALTER TABLE ${schema}.courses ADD COLUMN IF NOT EXISTS celular TEXT`);
    await pool.query(`ALTER TABLE ${schema}.courses ADD COLUMN IF NOT EXISTS correo_institucional TEXT`);
    console.log('  documento/celular/correo_institucional listas (si no existían).');
    console.log('Listo.');
}

main()
    .catch((err) => {
        console.error('Error actualizando columnas de courses:', err.message);
        process.exitCode = 1;
    })
    .finally(() => pool.end());
