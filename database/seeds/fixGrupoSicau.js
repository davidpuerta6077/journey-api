// Backfill: corrige `grupo` (y los códigos derivados de él) en `courses` y
// `enrollments` que se guardaron ANTES del fix que le agrega la "G" al grupo
// enviado por SICAU (ver api/SICAU/controller.js -> normalizeGrupo). Sin este
// backfill, la próxima vez que SICAU reenvíe uno de estos cursos/matrículas,
// el idnumber/codigo_journey calculado (con G) no coincidirá con el guardado
// (sin G) y se insertará como registro nuevo en vez de actualizar el existente.
//
// Solo toca courses.idnumber cuando sigue exactamente el patrón
// codigo_asignatura+periodo+grupo (lo que arma saveSicauCurso); si no,
// se omite por seguridad (puede ser un curso no proveniente de SICAU).
//
// Uso:
//   node database/seeds/fixGrupoSicau.js          (aplica los cambios)
//   node database/seeds/fixGrupoSicau.js --dry    (solo muestra, no escribe)

const { Pool } = require('pg');
const config = require('../../config');

const schema = config.postgresql.schema;
const DRY = process.argv.includes('--dry');

const pool = new Pool({
    database: config.postgresql.database,
    user:     config.postgresql.user,
    password: config.postgresql.password,
    host:     config.postgresql.host,
    port:     config.postgresql.port,
});

function normalizeGrupo(grupo) {
    if (grupo === null || grupo === undefined) return grupo;
    const g = String(grupo).trim();
    if (!g) return g;
    return /^G/i.test(g) ? `G${g.slice(1)}` : `G${g}`;
}

async function fixCourses() {
    const { rows } = await pool.query(
        `SELECT id, codigo_asignatura, periodo, grupo, idnumber FROM ${schema}.courses WHERE grupo IS NOT NULL AND grupo != ''`
    );
    let cambiados = 0, omitidos = 0, errores = 0;
    for (const c of rows) {
        const nuevoGrupo = normalizeGrupo(c.grupo);
        if (nuevoGrupo === c.grupo) continue;

        const idnumberViejoEsperado = `${c.codigo_asignatura || ''}${c.periodo || ''}${c.grupo || ''}`;
        if (c.idnumber !== idnumberViejoEsperado) {
            console.log(`  course #${c.id}: idnumber "${c.idnumber}" no sigue el patrón codigo+periodo+grupo, se omite`);
            omitidos++;
            continue;
        }
        const nuevoIdnumber = `${c.codigo_asignatura || ''}${c.periodo || ''}${nuevoGrupo}`;
        console.log(`  course #${c.id}: grupo "${c.grupo}" -> "${nuevoGrupo}", idnumber "${c.idnumber}" -> "${nuevoIdnumber}"`);
        cambiados++;
        if (!DRY) {
            try {
                await pool.query(
                    `UPDATE ${schema}.courses SET grupo = $1, idnumber = $2 WHERE id = $3`,
                    [nuevoGrupo, nuevoIdnumber, c.id]
                );
            } catch (err) {
                console.error(`  ERROR actualizando course #${c.id}: ${err.message}`);
                errores++;
            }
        }
    }
    console.log(`courses: ${cambiados}/${rows.length} ${DRY ? 'a cambiar' : 'actualizados'}, ${omitidos} omitidos, ${errores} con error`);
}

async function fixEnrollments() {
    const { rows } = await pool.query(
        `SELECT id, codigo_asignatura, periodo, grupo, codigo_journey FROM ${schema}.enrollments WHERE grupo IS NOT NULL AND grupo != ''`
    );
    let cambiados = 0, omitidos = 0, errores = 0;
    for (const e of rows) {
        const nuevoGrupo = normalizeGrupo(e.grupo);
        if (nuevoGrupo === e.grupo) continue;

        const codigoViejoEsperado = `${e.codigo_asignatura || ''}${e.periodo || ''}${e.grupo || ''}`;
        if (e.codigo_journey !== codigoViejoEsperado) {
            console.log(`  enrollment #${e.id}: codigo_journey "${e.codigo_journey}" no sigue el patrón codigo+periodo+grupo, se omite`);
            omitidos++;
            continue;
        }
        const nuevoCodigoJourney = `${e.codigo_asignatura || ''}${e.periodo || ''}${nuevoGrupo}`;
        console.log(`  enrollment #${e.id}: grupo "${e.grupo}" -> "${nuevoGrupo}", codigo_journey "${e.codigo_journey}" -> "${nuevoCodigoJourney}"`);
        cambiados++;
        if (!DRY) {
            try {
                await pool.query(
                    `UPDATE ${schema}.enrollments SET grupo = $1, codigo_journey = $2 WHERE id = $3`,
                    [nuevoGrupo, nuevoCodigoJourney, e.id]
                );
            } catch (err) {
                console.error(`  ERROR actualizando enrollment #${e.id}: ${err.message}`);
                errores++;
            }
        }
    }
    console.log(`enrollments: ${cambiados}/${rows.length} ${DRY ? 'a cambiar' : 'actualizados'}, ${omitidos} omitidos, ${errores} con error`);
}

async function main() {
    console.log(`Corrigiendo grupos SICAU sin "G" en schema '${schema}'${DRY ? ' (DRY RUN)' : ''}...`);
    await fixCourses();
    await fixEnrollments();
    console.log('Listo.');
}

main()
    .catch((err) => {
        console.error('Error corrigiendo grupos SICAU:', err.message);
        process.exitCode = 1;
    })
    .finally(() => pool.end());
