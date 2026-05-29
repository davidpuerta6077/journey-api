const { Router } = require('express');
const router = Router();
const response = require('../../network/response');
const ctrl = require('./index');
const { moodleRequest } = require('../../services/moodleService');
const syncService = require('../../services/syncService');

// ─── RUTAS MOODLE ─────────────────────────────────────────────────────────────

router.post('/add_course', async (req, res) => {
    try {
        const result = await moodleRequest('core_course_create_courses', {
            'courses[0][fullname]':    req.body.fullname,
            'courses[0][shortname]':   req.body.shortname,
            'courses[0][categoryid]':  req.body.categoryid,
            'courses[0][idnumber]':    req.body.idnumber,
            'courses[0][summary]':     req.body.summary,
            'courses[0][visible]':     req.body.visible,
            'courses[0][format]':      req.body.format,
            'courses[0][numsections]': req.body.numsections,
        });
        response.success(req, res, result, 200);
    } catch (error) {
        response.error(req, res, error.message, 500);
    }
});

router.post('/duplicate_course', async (req, res) => {
    try {
        const result = await moodleRequest('core_course_duplicate_course', {
            'courseid':   req.body.courseid,
            'fullname':   req.body.fullname,
            'shortname':  req.body.shortname,
            'categoryid': req.body.categoryid
        });
        response.success(req, res, result, 200);
    } catch (error) {
        response.error(req, res, error.message, 500);
    }
});

router.post('/update_course', async (req, res) => {
    try {
        const result = await moodleRequest('core_course_update_courses', {
            'courses[0][id]':         req.body.id,
            'courses[0][fullname]':   req.body.fullname,
            'courses[0][shortname]':  req.body.shortname,
            'courses[0][categoryid]': req.body.categoryid,
            'courses[0][idnumber]':   req.body.idnumber,
            'courses[0][summary]':    req.body.summary,
            'courses[0][visible]':    req.body.visible,
            'courses[0][format]':     req.body.format
        });
        response.success(req, res, result, 200);
    } catch (error) {
        response.error(req, res, error.message, 500);
    }
});

router.post('/delete_course', async (req, res) => {
    try {
        const result = await moodleRequest('core_course_delete_courses', {
            'courseids[0]': req.body.courseids
        });
        response.success(req, res, result, 200);
    } catch (error) {
        response.error(req, res, error.message, 500);
    }
});

router.post('/search_course', async (req, res) => {
    try {
        const result = await moodleRequest('core_course_get_courses_by_field', {
            'field': req.body.field,
            'value': req.body.value
        });
        response.success(req, res, result, 200);
    } catch (error) {
        response.error(req, res, error.message, 500);
    }
});

router.post('/list_course', async (req, res) => {
    try {
        const result = await moodleRequest('core_course_get_courses', {});
        response.success(req, res, result, 200);
    } catch (error) {
        response.error(req, res, error.message, 500);
    }
});

router.post('/list_course_content', async (req, res) => {
    try {
        const result = await moodleRequest('core_course_get_contents', {
            'courseid': req.body.courseid
        });
        response.success(req, res, result, 200);
    } catch (error) {
        response.error(req, res, error.message, 500);
    }
});

router.post('/add_category', async (req, res) => {
    try {
        const result = await moodleRequest('core_course_create_categories', {
            'categories[0][name]':              req.body.name,
            'categories[0][parent]':            req.body.parent,
            'categories[0][idnumber]':          req.body.idnumber,
            'categories[0][description]':       req.body.description,
            'categories[0][descriptionformat]': req.body.descriptionformat
        });
        response.success(req, res, result, 200);
    } catch (error) {
        response.error(req, res, error.message, 500);
    }
});

router.post('/list_category', async (req, res) => {
    try {
        const result = await moodleRequest('core_course_get_categories', {});
        response.success(req, res, result, 200);
    } catch (error) {
        response.error(req, res, error.message, 500);
    }
});

router.get('/list', async (req, res) => {
    try {
        const list = await ctrl.listCoursesForSync();
        response.success(req, res, list, 200);
    } catch (error) {
        response.error(req, res, error.message, 500);
    }
});

// ─── RUTA SICAU ───────────────────────────────────────────────────────────────

router.post('/sicau', async (req, res, next) => {
    try {
        const items = req.body.courses || req.body.items || req.body || [];
        const lista = Array.isArray(items) ? items : [items];
        const results = [];
        for (const course of lista) {
            const result = await ctrl.saveSicauCurso(course);
            results.push(result);
        }
        response.success(req, res, { results }, 200);
    } catch (error) {
        next(error);
    }
});

// ─── SYNC ─────────────────────────────────────────────────────────────────────

router.post(['/sync/preview', '/sync/preview/'], async (req, res, next) => {
    try {
        const result = await syncService.previewCourses();
        response.success(req, res, result, 200);
    } catch (error) {
        next(error);
    }
});

router.post(['/sync', '/sync/'], async (req, res, next) => {
    try {
        const result = await syncService.syncCourses(req.body.items || []);
        response.success(req, res, result || 'Datos cargados correctamente', 200);
    } catch (error) {
        next(error);
    }
});

module.exports = router;