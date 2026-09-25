// Backfill: normaliza los datos YA existentes en `users` y `courses` aplicando
// las mismas reglas que services/normalize.js. Idempotente: solo escribe las
// filas que cambian. Uso:
//   node database/seeds/normalizeExistingData.js          (aplica los cambios)
//   node database/seeds/normalizeExistingData.js --dry    (solo muestra, no escribe)

const { Pool } = require('pg');
const config = require('../../config');
const { normalizeUser, normalizeCourse, normalizeEnrollment, buildCourseNames, difiere } = require('../../services/normalize');

const schema = config.postgresql.schema;
const DRY = process.argv.includes('--dry');

const pool = new Pool({
    database: config.postgresql.database,
    user:     config.postgresql.user,
    password: config.postgresql.password,
    host:     config.postgresql.host,
    port:     config.postgresql.port,
});

const CAMPOS_USER = ['firstname', 'lastname', 'email', 'correo_personal'];
const CAMPOS_COURSE = ['fullname', 'shortname', 'nombre_asignatura', 'nombre_profesor', 'departamento', 'programa'];
const CAMPOS_ENROLLMENT = ['nombre_asignatura', 'programa'];

async function normalizarUsuarios() {
    const { rows } = await pool.query(
        `SELECT id, firstname, lastname, email, correo_personal FROM ${schema}.users ORDER BY id`
    );
    let cambiados = 0;
    for (const u of rows) {
        const norm = normalizeUser(u);
        if (!difiere(u, norm, CAMPOS_USER)) continue;
        cambiados++;
        console.log(`  user #${u.id}: "${u.firstname} ${u.lastname}" <${u.email}> -> "${norm.firstname} ${norm.lastname}" <${norm.email}>`);
        if (!DRY) {
            await pool.query(
                `UPDATE ${schema}.users SET firstname = $1, lastname = $2, email = $3, correo_personal = $4 WHERE id = $5`,
                [norm.firstname, norm.lastname, norm.email, norm.correo_personal ?? null, u.id]
            );
        }
    }
    console.log(`users: ${cambiados}/${rows.length} ${DRY ? 'a cambiar' : 'actualizados'}`);
}

async function normalizarCursos() {
    const { rows } = await pool.query(
        `SELECT id, fullname, shortname, nombre_asignatura, nombre_profesor, departamento, programa,
                grupo, codigo_asignatura, periodo
         FROM ${schema}.courses ORDER BY id`
    );
    let cambiados = 0;
    for (const c of rows) {
        const norm = normalizeCourse(c);
        // cleanSpaces por sí solo no recapitaliza lo que ya quedó escrito en
        // fullname/shortname (curso viejo con nombre/profesor en mayúsculas
        // incrustado en el string). Si el curso trae los datos de SICAU
        // (grupo/codigo_asignatura/periodo), se rearma con el mismo formato de
        // la ingesta pero a partir de las piezas ya normalizadas.
        if (c.grupo && c.codigo_asignatura && c.periodo) {
            Object.assign(norm, buildCourseNames({
                grupo: c.grupo,
                nombreAsignatura: norm.nombre_asignatura,
                codigoAsignatura: c.codigo_asignatura,
                nombreProfesor: norm.nombre_profesor,
                periodo: c.periodo,
            }));
        }
        if (!difiere(c, norm, CAMPOS_COURSE)) continue;
        cambiados++;
        console.log(`  course #${c.id}: "${c.fullname}" -> "${norm.fullname}"`);
        if (!DRY) {
            await pool.query(
                `UPDATE ${schema}.courses
                 SET fullname = $1, shortname = $2, nombre_asignatura = $3,
                     nombre_profesor = $4, departamento = $5, programa = $6
                 WHERE id = $7`,
                [norm.fullname, norm.shortname, norm.nombre_asignatura ?? null,
                 norm.nombre_profesor ?? null, norm.departamento ?? null, norm.programa ?? null, c.id]
            );
        }
    }
    console.log(`courses: ${cambiados}/${rows.length} ${DRY ? 'a cambiar' : 'actualizados'}`);
}

async function normalizarMatriculas() {
    const { rows } = await pool.query(
        `SELECT id, nombre_asignatura, programa FROM ${schema}.enrollments ORDER BY id`
    );
    let cambiados = 0;
    for (const e of rows) {
        const norm = normalizeEnrollment(e);
        if (!difiere(e, norm, CAMPOS_ENROLLMENT)) continue;
        cambiados++;
        console.log(`  enrollment #${e.id}: "${e.nombre_asignatura}" / "${e.programa}" -> "${norm.nombre_asignatura}" / "${norm.programa}"`);
        if (!DRY) {
            await pool.query(
                `UPDATE ${schema}.enrollments SET nombre_asignatura = $1, programa = $2 WHERE id = $3`,
                [norm.nombre_asignatura ?? null, norm.programa ?? null, e.id]
            );
        }
    }
    console.log(`enrollments: ${cambiados}/${rows.length} ${DRY ? 'a cambiar' : 'actualizados'}`);
}

async function main() {
    console.log(`Normalizando datos existentes en schema '${schema}'${DRY ? ' (DRY RUN)' : ''}...`);
    await normalizarUsuarios();
    await normalizarCursos();
    await normalizarMatriculas();
    console.log('Listo.');
}

main()
    .catch((err) => {
        console.error('Error normalizando datos existentes:', err.message);
        process.exitCode = 1;
    })
    .finally(() => pool.end());
