// Corrige moodle_enrol y moodle_auth_users: las vistas que el plugin de Moodle
// "Base de datos externa" (enrol_database / auth_db) ya tiene configuradas y
// consulta por cron.
//
// Historia: la definición original filtraba por `sincronizado = true`, pero
// en ese entonces ese campo lo ponía en true el sync manual por WEBSERVICE
// (enrol_manual_enrol_users / core_user_create_users) DESPUÉS de matricular/
// crear en Moodle por ese camino. Como la vista además exponía esa misma fila
// ya sincronizada, el estudiante quedaba matriculado dos veces, bajo dos
// métodos a la vez ("Manual" + "Base de datos externa"). La corrección de ese
// momento fue quitar el filtro de sincronizado y dejar que el criterio saliera
// directo de los datos reales (estado académico activo, datos mínimos
// completos) — y que services/sync/syncEnrollments.js y syncStudents.js
// dejaran de llamar esos webservices de matrícula/creación, para que la única
// vía de inscripción/creación en Moodle fuera esta vista. Efecto colateral no
// pedido: sin el filtro de sincronizado, cualquier usuario o matrícula queda
// visible para el cron apenas se guarda, sin esperar a que alguien le dé
// "Sincronizar" en el panel.
//
// Ahora se vuelve a exigir sincronizado = true (para que sí haya que darle a
// "Sincronizar" antes de que Moodle tome el registro), pero esta vez sin
// revivir el bug de doble matriculación: ese bug dependía de que el sync
// manual matriculara/creara por webservice ADEMÁS de por esta vista, y ese
// webservice ya no se llama desde ningún lado (syncStudents.js/
// syncEnrollments.js solo marcan sincronizado = true en la BD). Con una sola
// vía de inscripción, agregar de nuevo el filtro solo retrasa cuándo esa vía
// ve la fila, no duplica nada.
//
// Idempotente: CREATE OR REPLACE VIEW no falla si ya existe, y no borra datos.
// Uso: node database/seeds/fixMoodleExternalDbViews.js

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

// Mismos estados que el motor de sync (services/sync/syncEnrollments.js)
// trata como matrícula activa/normal.
const ESTADOS_ACTIVOS = ['matriculado', 'matriculada', 'activa'];

async function main() {
    console.log(`Corrigiendo vistas de BD externa en ${schema}...`);

    await pool.query(`
        CREATE OR REPLACE VIEW ${schema}.moodle_enrol AS
        SELECT
            u.documento AS userid,
            c.idnumber  AS courseid,
            e.role
        FROM ${schema}.enrollments e
        JOIN ${schema}.users u ON u.id = e.userid
        JOIN ${schema}.courses c ON c.id = e.courseid
        WHERE lower(trim(e.estado)) = ANY (ARRAY[${ESTADOS_ACTIVOS.map(x => `'${x}'`).join(', ')}])
          AND e.role IN ('student', 'editingteacher', 'teacher')
          AND e.courseid IS NOT NULL
          AND e.sincronizado = true
    `);
    console.log('  moodle_enrol corregida (estado activo + sincronizado = true).');

    await pool.query(`
        CREATE OR REPLACE VIEW ${schema}.moodle_auth_users AS
        SELECT username, password, firstname, lastname, email, documento AS idnumber
        FROM ${schema}.users
        WHERE username IS NOT NULL AND password IS NOT NULL AND documento IS NOT NULL
          AND sincronizado = true
    `);
    console.log('  moodle_auth_users corregida (datos mínimos + sincronizado = true).');

    const enrol = await pool.query(`SELECT count(*) FROM ${schema}.moodle_enrol`);
    const auth  = await pool.query(`SELECT count(*) FROM ${schema}.moodle_auth_users`);
    console.log(`Listo. moodle_enrol: ${enrol.rows[0].count} fila(s). moodle_auth_users: ${auth.rows[0].count} fila(s).`);
}

main()
    .catch((err) => {
        console.error('Error corrigiendo las vistas de BD externa:', err.message);
        process.exitCode = 1;
    })
    .finally(() => pool.end());
