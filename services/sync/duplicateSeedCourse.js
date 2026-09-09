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
        'visible':    1
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
