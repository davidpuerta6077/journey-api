const coursesCtrl = require('../../api/courses/index');
const { moodleRequest } = require('../moodleService');
const { logSyncError } = require('../syncLog');
const { assertMoodleOk } = require('../moodleAssert');
const { normalizeCourse, difiere } = require('../normalize');

const CAMPOS_NORM = ['fullname', 'shortname', 'nombre_asignatura'];

async function syncCourses(items = [], username = 'system') {
    const results = [];

    for (const course of items) {
        const result = { id: course.id, shortname: course.shortname };

        try {
            if (!course.id) {
                throw new Error('Sin ID de curso');
            }

            // Normalizar antes de mandar a Moodle: limpiar espacios en
            // fullname/shortname y capitalizar nombre_asignatura. Si cambió algo,
            // se persiste también en la BD de Journey.
            const norm = normalizeCourse(course);
            if (difiere(course, norm, CAMPOS_NORM)) {
                await coursesCtrl.applyNormalization(course.id, norm);
            }
            if (norm.fullname != null) course.fullname = norm.fullname;
            if (norm.shortname != null) course.shortname = norm.shortname;
            if (norm.nombre_asignatura != null) course.nombre_asignatura = norm.nombre_asignatura;

            // ─── Idempotencia: el curso ya existe en Moodle ────────────────────
            // No se recrea; solo se actualiza la metadata que pudo cambiar
            // (fechas, docente, nombre, etc. ya viven en fullname/shortname).
            if (course.moodle_id) {
                const updateResp = await moodleRequest('core_course_update_courses', {
                    'courses[0][id]':        course.moodle_id,
                    'courses[0][fullname]':  course.fullname,
                    'courses[0][shortname]': course.shortname,
                    'courses[0][idnumber]':  course.idnumber
                });
                assertMoodleOk(updateResp, 'Error actualizando metadata del curso existente');

                await coursesCtrl.markCourseAsSynchronized(course.id);

                result.status = 'success';
                result.moodle_id = course.moodle_id;
                result.message = 'El curso ya existía en Moodle; se actualizó su metadata';
                results.push(result);
                continue;
            }

            // ─── No existe todavía: usar la regla pre-aplicada (botón "Aplicar
            // regla" en Sync Cursos) si ya está guardada, o resolverla ahora ────
            let categoryid = course.categoryid;
            let semillaId  = course.seed_course_id;
            let seedShortnameUsado = semillaId ? `id ${semillaId} (regla ya aplicada)` : null;

            if (!semillaId || !categoryid) {
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
                assertMoodleOk(semillaResult, 'Error buscando el curso semilla');
                if (!semillaResult?.courses?.length) {
                    throw new Error(`Semilla no encontrada en Moodle: ${rule.seed_shortname}`);
                }
                categoryid = rule.categoryid;
                semillaId = semillaResult.courses[0].id;
                seedShortnameUsado = rule.seed_shortname;
            }

            // 2. Duplicar el curso semilla en la categoría resuelta por la regla
            const duplicado = await moodleRequest('core_course_duplicate_course', {
                'courseid':   semillaId,
                'fullname':   course.fullname,
                'shortname':  course.shortname,
                'categoryid': categoryid,
                'visible':    1
            });
            assertMoodleOk(duplicado, 'Error duplicando el curso semilla');
            if (!duplicado?.id) {
                throw new Error('Moodle no devolvió el ID del curso duplicado');
            }

            // 3. Fijar el idnumber (código journey) del curso duplicado
            const idnumberResp = await moodleRequest('core_course_update_courses', {
                'courses[0][id]':        duplicado.id,
                'courses[0][idnumber]':  course.idnumber,
                'courses[0][fullname]':  course.fullname,
                'courses[0][shortname]': course.shortname
            });
            assertMoodleOk(idnumberResp, 'Error fijando el idnumber del curso');

            // 4. Guardar moodle_id/seed_course_id/categoryid y marcar como sincronizado
            await coursesCtrl.setCourseSyncFields(course.id, {
                moodle_id: duplicado.id,
                seed_course_id: semillaId,
                categoryid: categoryid
            });
            await coursesCtrl.markCourseAsSynchronized(course.id);

            result.status = 'success';
            result.moodle_id = duplicado.id;
            result.message = `Curso creado en Moodle desde semilla ${seedShortnameUsado}`;

        } catch (error) {
            console.error('Error sincronizando curso:', course.shortname, error.message);
            result.status = 'error';
            result.error = error.message;
            if (course.id) {
                await coursesCtrl.markCourseSyncFailed(course.id);
                await logSyncError('course', course.id, error.message, username);
            }
        }

        results.push(result);
    }

    return { results };
}

module.exports = { syncCourses };
