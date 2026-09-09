const coursesCtrl = require('../../api/courses/index');
const { moodleRequest } = require('../moodleService');
const { assertMoodleOk } = require('../moodleAssert');
const { logSyncError } = require('../syncLog');

// Paso intermedio, previo a "Sincronizar": resuelve la regla (sync_rules) para el
// curso, verifica que la semilla exista en Moodle, y guarda categoryid/seed_course_id
// en la fila local -- SIN crear todavía el curso en Moodle (moodle_id sigue null).
// Permite revisar qué semilla/categoría le tocó a un curso antes de comprometerse
// a duplicarlo. syncCourses.js reutiliza estos valores si ya están presentes.
async function applyCourseRule(items = [], username = 'system') {
    const results = [];

    for (const course of items) {
        const result = { id: course.id, shortname: course.shortname };

        try {
            if (!course.id) {
                throw new Error('Sin ID de curso');
            }
            if (course.moodle_id) {
                throw new Error('El curso ya está sincronizado en Moodle; no aplica re-resolver la regla');
            }

            const rule = await coursesCtrl.resolveSyncRule(
                course.codigo_asignatura,
                course.programa,
                course.departamento
            );
            if (!rule) {
                throw new Error(
                    `No se encontró una regla de sincronización (sync_rules) aplicable a ` +
                    `codigo_asignatura=${course.codigo_asignatura}, programa=${course.programa}, departamento=${course.departamento}`
                );
            }

            const semillaResult = await moodleRequest('core_course_get_courses_by_field', {
                'field': 'shortname',
                'value': rule.seed_shortname
            });
            assertMoodleOk(semillaResult, 'Error verificando el curso semilla');
            if (!semillaResult?.courses?.length) {
                throw new Error(`Semilla no encontrada en Moodle: ${rule.seed_shortname}`);
            }
            const semillaId = semillaResult.courses[0].id;

            await coursesCtrl.setCourseSyncFields(course.id, {
                moodle_id: null,
                seed_course_id: semillaId,
                categoryid: rule.categoryid
            });

            result.status = 'success';
            result.seed_shortname = rule.seed_shortname;
            result.categoryid = rule.categoryid;
            result.message = `Regla aplicada: semilla ${rule.seed_shortname}, categoría ${rule.categoryid}`;

        } catch (error) {
            console.error('Error aplicando regla al curso:', course.shortname, error.message);
            result.status = 'error';
            result.error = error.message;
            if (course.id) {
                await logSyncError('course', course.id, `Aplicar regla: ${error.message}`, username);
            }
        }

        results.push(result);
    }

    return { results };
}

module.exports = { applyCourseRule };
