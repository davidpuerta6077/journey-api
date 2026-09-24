// Corrige moodle_enrol y moodle_auth_users: las vistas que el plugin de Moodle
// "Base de datos externa" (enrol_database / auth_db) ya tiene configuradas y
// consulta por cron. Su definición original filtraba por `sincronizado = true`
// — pero ese campo lo pone en true el sync manual por webservice DESPUÉS de
// matricular/crear en Moodle, así que la vista solo "veía" lo que YA se había
// hecho por ese otro camino. Efecto: cada matrícula quedaba duplicada bajo dos
// métodos de inscripción en Moodle a la vez ("Manual" + "Base de datos
// externa"), y cada usuario nuevo no aparecía en Moodle hasta que alguien
// hacía clic en Sincronizar en el módulo de Usuarios.
//
// La corrección: que el criterio salga directo de los datos reales (estado
// académico activo para matrículas, datos mínimos completos para usuarios),
// sin depender de si el webservice ya corrió. A partir de este cambio, y de
// que services/sync/syncEnrollments.js deje de llamar al webservice de
// matrícula, la única vía de inscripción/creación en Moodle es esta.
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
    `);
    console.log('  moodle_enrol corregida (ahora filtra por estado, no por sincronizado).');

    await pool.query(`
        CREATE OR REPLACE VIEW ${schema}.moodle_auth_users AS
        SELECT username, password, firstname, lastname, email, documento AS idnumber
        FROM ${schema}.users
        WHERE username IS NOT NULL AND password IS NOT NULL AND documento IS NOT NULL
    `);
    console.log('  moodle_auth_users corregida (ahora filtra por datos mínimos, no por sincronizado).');

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
