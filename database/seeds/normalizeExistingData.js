// Backfill: normaliza los datos YA existentes en `users` y `courses` aplicando
// las mismas reglas que services/normalize.js. Idempotente: solo escribe las
// filas que cambian. Uso:
//   node database/seeds/normalizeExistingData.js          (aplica los cambios)
//   node database/seeds/normalizeExistingData.js --dry    (solo muestra, no escribe)

const { Pool } = require('pg');
const config = require('../../config');
const { normalizeUser, normalizeCourse, difiere } = require('../../services/normalize');

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
const CAMPOS_COURSE = ['fullname', 'shortname', 'nombre_asignatura'];

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
        `SELECT id, fullname, shortname, nombre_asignatura FROM ${schema}.courses ORDER BY id`
    );
    let cambiados = 0;
    for (const c of rows) {
        const norm = normalizeCourse(c);
        if (!difiere(c, norm, CAMPOS_COURSE)) continue;
        cambiados++;
        console.log(`  course #${c.id}: nombre_asignatura "${c.nombre_asignatura}" -> "${norm.nombre_asignatura}"`);
        if (!DRY) {
            await pool.query(
                `UPDATE ${schema}.courses SET fullname = $1, shortname = $2, nombre_asignatura = $3 WHERE id = $4`,
                [norm.fullname, norm.shortname, norm.nombre_asignatura ?? null, c.id]
            );
        }
    }
    console.log(`courses: ${cambiados}/${rows.length} ${DRY ? 'a cambiar' : 'actualizados'}`);
}

async function main() {
    console.log(`Normalizando datos existentes en schema '${schema}'${DRY ? ' (DRY RUN)' : ''}...`);
    await normalizarUsuarios();
    await normalizarCursos();
    console.log('Listo.');
}

main()
    .catch((err) => {
        console.error('Error normalizando datos existentes:', err.message);
        process.exitCode = 1;
    })
    .finally(() => pool.end());
