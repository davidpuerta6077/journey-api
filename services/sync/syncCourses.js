const coursesCtrl = require('../../api/courses/index');
const { moodleRequest } = require('../moodleService');
const { logSyncError } = require('../syncLog');
const { assertMoodleOk } = require('../moodleAssert');
const { normalizeCourse, difiere } = require('../normalize');
const { duplicateSeedCourse } = require('./duplicateSeedCourse');

const CAMPOS_NORM = ['fullname', 'shortname', 'nombre_asignatura'];

// Moodle espera startdate/enddate como timestamp Unix (segundos); fecha_inicio/
// fecha_fin llegan de SICAU como fecha/timestamp de Postgres.
function toUnixTimestamp(value) {
    if (!value) return null;
    const ms = new Date(value).getTime();
    return Number.isNaN(ms) ? null : Math.floor(ms / 1000);
}

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

            await coursesCtrl.markCourseSyncing(course.id);

            // ─── Idempotencia: el curso ya existe en Moodle ────────────────────
            // No se recrea; solo se actualiza la metadata que pudo cambiar
            // (fechas, docente, nombre, etc. ya viven en fullname/shortname).
            if (course.moodle_id) {
                const startdate = toUnixTimestamp(course.fecha_inicio);
                const enddate   = toUnixTimestamp(course.fecha_fin);
                const updateResp = await moodleRequest('core_course_update_courses', {
                    'courses[0][id]':        course.moodle_id,
                    'courses[0][fullname]':  course.fullname,
                    'courses[0][shortname]': course.shortname,
                    'courses[0][idnumber]':  course.idnumber,
                    ...(startdate ? { 'courses[0][startdate]': startdate } : {}),
                    ...(enddate   ? { 'courses[0][enddate]':   enddate }   : {})
                });
                assertMoodleOk(updateResp, 'Error actualizando metadata del curso existente');

                await coursesCtrl.markCourseAsSynchronized(course.id);

                result.status = 'success';
                result.moodle_id = course.moodle_id;
                result.message = 'El curso ya existía en Moodle; se actualizó su metadata';
                results.push(result);
                continue;
            }

            // ─── No existe todavía: resolver semilla/categoría ─────────────────
            // Si el usuario eligió a mano una regla puntual (rule_id, desde el
            // selector de Sync Cursos), esa manda siempre, aunque el curso ya
            // tuviera categoryid/seed_course_id de una corrida anterior.
            let categoryid = course.rule_id ? null : course.categoryid;
            let semillaId  = course.rule_id ? null : course.seed_course_id;
            let seedShortnameUsado = semillaId ? `id ${semillaId} (regla ya aplicada)` : null;

            if (!semillaId || !categoryid) {
                const rule = course.rule_id
                    ? await coursesCtrl.getSyncRuleById(course.rule_id)
                    : await coursesCtrl.resolveSyncRule(
                        course.codigo_asignatura,
                        course.programa,
                        course.departamento
                    );
                if (!rule) {
                    throw new Error(
                        course.rule_id
                            ? `La regla seleccionada (id ${course.rule_id}) no existe o está inactiva`
                            : `No se encontró una regla de sincronización (sync_rules) aplicable a ` +
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

            // 2. Duplicar el curso semilla en la categoría resuelta por la regla,
            // y fijar el idnumber (código journey)/fechas del curso duplicado
            // (la semilla trae sus propias fechas, que no aplican al periodo
            // real del curso nuevo).
            const { moodle_id } = await duplicateSeedCourse({
                semillaId,
                categoryid,
                fullname: course.fullname,
                shortname: course.shortname,
                idnumber: course.idnumber,
                fecha_inicio: course.fecha_inicio,
                fecha_fin: course.fecha_fin
            });

            // 3. Guardar moodle_id/seed_course_id/categoryid y marcar como sincronizado
            await coursesCtrl.setCourseSyncFields(course.id, {
                moodle_id,
                seed_course_id: semillaId,
                categoryid: categoryid
            });
            await coursesCtrl.markCourseAsSynchronized(course.id);

            result.status = 'success';
            result.moodle_id = moodle_id;
            result.message = `Curso creado en Moodle desde semilla ${seedShortnameUsado}`;

        } catch (error) {
            console.error('Error sincronizando curso:', course.shortname, error.message);
            result.status = 'error';
            result.error = error.message;
            if (course.id) {
                await coursesCtrl.markCourseSyncFailed(course.id, error.message);
                await logSyncError('course', course.id, error.message, username);
            }
        }

        results.push(result);
    }

    return { results };
}

module.exports = { syncCourses };
