const { moodleRequest } = require('../moodleService');
const { assertMoodleOk } = require('../moodleAssert');

// core_course_duplicate_course dispara un backup+restore completo dentro de
// Moodle: con semillas grandes puede tardar más que un request HTTP normal.
// Se le da un timeout amplio y, si aun así no responde a tiempo, se verifica
// por shortname antes de darlo por fallido: el backup pudo haber terminado del
// lado de Moodle aunque el cliente ya haya cortado la espera, y sin esa
// verificación un reintento duplicaría la semilla otra vez.
const DUPLICATE_TIMEOUT_MS = 120000;

function toUnixTimestamp(value) {
    if (!value) return null;
    const ms = new Date(value).getTime();
    return Number.isNaN(ms) ? null : Math.floor(ms / 1000);
}

// 'users'=0 evita que Moodle copie los datos personales al duplicar, pero no
// garantiza un curso sin matriculados: si el usuario de la semilla ya existe
// en el sitio (mismo username), Moodle puede seguir recreando su inscripción
// por referencia. Como la opción 'enrolments' no se puede pedir vía
// core_course_duplicate_course (ver comentario en duplicateSeedCourse), se
// hace como paso aparte: se listan los matriculados de la copia recién creada
// y se desmatriculan uno por uno. Es limpieza best-effort -si falla, se loguea
// pero no se revierte la duplicación, que ya se dio por buena-.
async function removeLeakedEnrollments(courseid) {
    const matriculados = await moodleRequest('core_enrol_get_enrolled_users', { courseid });
    if (!Array.isArray(matriculados) || matriculados.length === 0) return;

    for (const user of matriculados) {
        const result = await moodleRequest('enrol_manual_unenrol_users', {
            'enrolments[0][userid]':   user.id,
            'enrolments[0][courseid]': courseid
        });
        if (result?.exception) {
            console.error(`No se pudo desmatricular al usuario ${user.id} de la copia ${courseid}:`, result.message);
        }
    }
}

// Duplica `semillaId` como un curso nuevo (fullname/shortname/categoryid) y le
// fija idnumber/fechas de inicio-fin, que la semilla no trae. Usado tanto por
// la sincronización automática (syncCourses.js) como por la creación manual
// desde el Módulo Cursos.
async function duplicateSeedCourse({ semillaId, categoryid, fullname, shortname, idnumber, fecha_inicio, fecha_fin }) {
    // El idnumber (código journey) tiene que ser único en Moodle. Si ya lo tiene
    // otro curso, core_course_update_courses NO lanza excepción -devuelve 200
    // con un warning y sigue de largo-, así que sin este chequeo se terminaba
    // duplicando la semilla igual y el curso nuevo quedaba en Moodle sin el
    // idnumber real puesto (lo que después le impide matricular gente en él,
    // porque las matrículas buscan el curso por idnumber). Se valida antes de
    // gastar el backup+restore de la semilla, no después.
    if (idnumber) {
        const existente = await moodleRequest('core_course_get_courses_by_field', {
            'field': 'idnumber',
            'value': idnumber
        });
        assertMoodleOk(existente, 'Error verificando disponibilidad del idnumber');
        if (existente?.courses?.length) {
            const otro = existente.courses[0];
            throw new Error(
                `El código "${idnumber}" ya está asignado a otro curso en Moodle: ` +
                `${otro.shortname} (id ${otro.id}). Corrige el idnumber duplicado antes de sincronizar.`
            );
        }
    }

    let duplicado = await moodleRequest('core_course_duplicate_course', {
        'courseid':   semillaId,
        'fullname':   fullname,
        'shortname':  shortname,
        'categoryid': categoryid,
        'visible':    1,
        // La semilla original conserva sus matriculados; la copia nace vacía.
        // No se puede pedirle esto a Moodle pasando también la opción
        // 'enrolments' (que en teoría es la que de verdad controla si el
        // matriculado queda inscrito en la copia, ver removeLeakedEnrollments
        // más abajo): el propio core_course_duplicate_course de Moodle
        // (course/externallib.php) revisa esa opción contra los ajustes del
        // BACKUP -donde 'enrolments' no existe, solo existe del lado del
        // restore- y su get_setting() lanza excepción en vez de devolver
        // false, así que pedirla tumba toda la duplicación con
        // "error/setting_by_name_not_found".
        'options[0][name]':  'users',
        'options[0][value]': 0
    }, DUPLICATE_TIMEOUT_MS);

    if (duplicado === null) {
        const reconciliado = await moodleRequest('core_course_get_courses_by_field', {
            'field': 'shortname',
            'value': shortname
        });
        if (reconciliado?.courses?.length) {
            duplicado = { id: reconciliado.courses[0].id };
        }
    }

    assertMoodleOk(duplicado, 'Error duplicando el curso semilla');
    if (!duplicado?.id) {
        throw new Error('Moodle no devolvió el ID del curso duplicado');
    }

    try {
        await removeLeakedEnrollments(duplicado.id);
    } catch (error) {
        console.error(`Error limpiando matriculados de la copia ${duplicado.id}:`, error.message);
    }

    const startdate = toUnixTimestamp(fecha_inicio);
    const enddate   = toUnixTimestamp(fecha_fin);
    const idnumberResp = await moodleRequest('core_course_update_courses', {
        'courses[0][id]':        duplicado.id,
        'courses[0][idnumber]':  idnumber,
        'courses[0][fullname]':  fullname,
        'courses[0][shortname]': shortname,
        ...(startdate ? { 'courses[0][startdate]': startdate } : {}),
        ...(enddate   ? { 'courses[0][enddate]':   enddate }   : {})
    });
    assertMoodleOk(idnumberResp, 'Error fijando el idnumber del curso');

    return { moodle_id: duplicado.id };
}

module.exports = { duplicateSeedCourse };
