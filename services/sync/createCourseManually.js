const coursesCtrl = require('../../api/courses/index');
const { moodleRequest } = require('../moodleService');
const { assertMoodleOk } = require('../moodleAssert');
const { duplicateSeedCourse } = require('./duplicateSeedCourse');

// Creación manual desde el Módulo Cursos: a diferencia de Sync Cursos (que
// resuelve semilla/categoría por sync_rules a partir de datos de SICAU), aquí
// el usuario elige la semilla y llena fullname/shortname/idnumber/docente a
// mano. El curso queda duplicado en Moodle y con una fila local ya marcada
// como sincronizada (moodle_id set), igual que si hubiera pasado por Sync
// Cursos.
async function createCourseManually(input) {
    const {
        seed_shortname, categoryid, fullname, shortname, idnumber,
        docente, periodo, grupo, departamento, programa,
        codigo_asignatura, nombre_asignatura, fecha_inicio, fecha_fin
    } = input;

    if (!seed_shortname || !categoryid || !fullname || !shortname) {
        throw new Error('Semilla, categoría, nombre completo y nombre corto son obligatorios');
    }

    const semillaResult = await moodleRequest('core_course_get_courses_by_field', {
        'field': 'shortname',
        'value': seed_shortname
    });
    assertMoodleOk(semillaResult, 'Error buscando el curso semilla');
    if (!semillaResult?.courses?.length) {
        throw new Error(`Semilla no encontrada en Moodle: ${seed_shortname}`);
    }
    const semillaId = semillaResult.courses[0].id;

    const { moodle_id } = await duplicateSeedCourse({
        semillaId,
        categoryid,
        fullname,
        shortname,
        idnumber,
        fecha_inicio,
        fecha_fin
    });

    const created = await coursesCtrl.addElement({
        fullname, shortname, idnumber, categoryid,
        moodle_id, seed_course_id: semillaId,
        summary: null, visible: true, format: 'topics', numsections: 10,
        departamento, programa, docente, fecha_inicio, fecha_fin,
        periodo, grupo, codigo_asignatura, nombre_asignatura,
        templatecourse: seed_shortname
    });
    const courseRow = created[0];
    await coursesCtrl.markCourseAsSynchronized(courseRow.id);

    return { ...courseRow, moodle_id, sincronizado: true, estado_sync: 'sincronizado' };
}

module.exports = { createCourseManually };
