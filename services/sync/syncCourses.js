const coursesCtrl = require('../../api/courses/index');
const { moodleRequest } = require('../moodleService');

async function syncCourses(items = []) {
    const results = [];

    for (const course of items) {
        const result = { id: course.id, shortname: course.shortname };

        try {
            if (!course.id) {
                result.status = 'error';
                result.error = 'Sin ID de curso';
                results.push(result);
                continue;
            }

            // 1. Buscar el ID de la semilla en Moodle por shortname
            const semillaShortname = course.templatecourse;
            if (!semillaShortname) {
                result.status = 'error';
                result.error = 'Sin templatecourse definido';
                results.push(result);
                continue;
            }

            const semillaResult = await moodleRequest('core_course_get_courses_by_field', {
                'field': 'shortname',
                'value': semillaShortname
            });

            console.log('Semilla encontrada:', JSON.stringify(semillaResult, null, 2));

            if (!semillaResult?.courses?.length) {
                result.status = 'error';
                result.error = `Semilla no encontrada en Moodle: ${semillaShortname}`;
                results.push(result);
                continue;
            }

            const semillaId = semillaResult.courses[0].id;

            // 2. Duplicar el curso semilla
            const duplicado = await moodleRequest('core_course_duplicate_course', {
                'courseid':   semillaId,
                'fullname':   course.fullname,
                'shortname':  course.shortname,
                'categoryid': semillaResult.courses[0].categoryid,
                'visible':    1
            });

            console.log('Respuesta duplicado Moodle:', JSON.stringify(duplicado, null, 2));

            if (!duplicado?.id) {
                result.status = 'error';
                result.error = 'Moodle no devolvió el ID del curso duplicado';
                results.push(result);
                continue;
            }

            // 3. Actualizar idnumber del curso en Moodle
            await moodleRequest('core_course_update_courses', {
                'courses[0][id]':        duplicado.id,
                'courses[0][idnumber]':  course.idnumber,
                'courses[0][fullname]':  course.fullname,
                'courses[0][shortname]': course.shortname
            });

            // 4. Guardar moodle_id en Journey y marcar como sincronizado
            await coursesCtrl.updateCourseMoodleId(course.id, duplicado.id);
            await coursesCtrl.markCourseAsSynchronized(course.id);

            result.status = 'success';
            result.moodle_id = duplicado.id;
            result.message = `Curso creado en Moodle desde semilla ${semillaShortname}`;

        } catch (error) {
            console.error('Error sincronizando curso:', course.shortname, error.message);
            result.status = 'error';
            result.error = error.message;
        }

        results.push(result);
    }

    return { results };
}

module.exports = { syncCourses };