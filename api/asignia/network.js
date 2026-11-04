const fs = require('fs');
const path = require('path');
const { Router } = require('express');
const router = Router();
const response = require('../../network/response');
const ctrl = require('./index');
const { SUBMODULE } = require('./controller');
const checkAuth = require('../../middleware/checkAuth');
const checkPermission = require('../../middleware/checkPermissions');
const saveLog = require('../../middleware/saveLog');

const run = (fn) => async (req, res, next) => {
    try {
        response.success(req, res, await fn(req), 200);
    } catch (error) {
        next(error);
    }
};

const ESTADO = { vacio: 'Vacío', asignado: 'Asignado', aceptado: 'Aceptado', rechazado: 'Rechazado', postulado: 'Postulado' };

/**
 * @swagger
 * /asignia/cursos:
 *   get:
 *     summary: Programación académica de un periodo (por defecto el más reciente) con su estado de verificación
 *     tags: [Asignia]
 *     parameters:
 *       - in: query
 *         name: periodo
 *         schema: { type: string }
 *     responses:
 *       200: { description: "{ periodo, periodos, cursos }" }
 */
router.get('/cursos', checkAuth, checkPermission(SUBMODULE), run((req) => ctrl.listarCursos(req.query.periodo)));

/**
 * @swagger
 * /asignia/cargar:
 *   post:
 *     summary: Cargar el Excel de programación (pestaña PROGRAMACIÓN). Campo de archivo "archivo", periodo opcional
 *     tags: [Asignia]
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               archivo: { type: string, format: binary }
 *               periodo: { type: string, example: "2027-1" }
 *     responses:
 *       200: { description: Resumen de la carga (nuevos, actualizados, sin cambios, omitidas) }
 */
router.post('/cargar', checkAuth, checkPermission(SUBMODULE), saveLog(SUBMODULE, {
    descripcion: (req) => `Cargó la programación académica ${req._logResumen?.periodo || ''} en Asignia`,
    detalle: (req) => req._logResumen ? { archivo: req._logArchivo, ...req._logResumen } : null,
}), async (req, res, next) => {
    const archivo = req.files?.archivo;
    try {
        if (!archivo) throw Object.assign(new Error('Adjunta el archivo de programación (.xlsx)'), { status: 400 });
        if (path.extname(archivo.name || '').toLowerCase() !== '.xlsx') {
            throw Object.assign(new Error('El archivo debe ser un Excel .xlsx'), { status: 400 });
        }
        const resumen = await ctrl.cargar(archivo.tempFilePath, req.body || {});
        req._logArchivo = archivo.name;
        req._logResumen = resumen;
        response.success(req, res, resumen, 200);
    } catch (error) {
        next(error);
    } finally {
        if (archivo?.tempFilePath) fs.promises.unlink(archivo.tempFilePath).catch(() => {});
    }
});

/**
 * @swagger
 * /asignia/cursos/{id}/postulaciones:
 *   get: { summary: Postulaciones recibidas para un curso, tags: [Asignia] }
 * /asignia/cursos/{id}/liberar:
 *   post: { summary: Quitar el profesor del curso y dejarlo vacío (descarta postulaciones pendientes), tags: [Asignia] }
 * /asignia/postulaciones/{id}/aprobar:
 *   post: { summary: Aprobar una postulación (el postulante queda asignado y aceptado; las demás se descartan), tags: [Asignia] }
 */
router.get('/cursos/:id/postulaciones', checkAuth, checkPermission(SUBMODULE),
    run((req) => ctrl.listarPostulaciones(req.params.id)));

router.post('/cursos/:id/liberar', checkAuth, checkPermission(SUBMODULE), saveLog(SUBMODULE, {
    descripcion: (req) => `Liberó el curso ${req._logCurso?.codigo || ''} ${req._logCurso?.curso || ''} en Asignia`,
    entityId: (req) => req.params.id,
    detalle: (req) => req._logCurso ? {
        codigo: req._logCurso.codigo, curso: req._logCurso.curso, grupo: req._logCurso.grupo,
        periodo: req._logCurso.periodo, profesor_anterior: req._logAnterior || '—', estado_anterior: req._logEstado,
    } : null,
}), run(async (req) => {
    const antes = await ctrl.listarPostulaciones(req.params.id);
    req._logAnterior = antes.curso.profesor_nombre;
    req._logEstado = ESTADO[antes.curso.verificacion];
    const curso = await ctrl.liberarCurso(req.params.id);
    req._logCurso = curso;
    return curso;
}));

router.post('/postulaciones/:id/aprobar', checkAuth, checkPermission(SUBMODULE), saveLog(SUBMODULE, {
    descripcion: (req) => `Aprobó la postulación de ${req._logAprob?.postulacion.nombre || ''} en Asignia`,
    entityId: (req) => req.params.id,
    detalle: (req) => req._logAprob ? {
        profesor: req._logAprob.postulacion.nombre, documento: req._logAprob.postulacion.documento,
        correo: req._logAprob.postulacion.correo, codigo: req._logAprob.curso.codigo,
        curso: req._logAprob.curso.curso, grupo: req._logAprob.curso.grupo, periodo: req._logAprob.curso.periodo,
    } : null,
}), run(async (req) => {
    const r = await ctrl.aprobarPostulacion(req.params.id);
    req._logAprob = r;
    return r.curso;
}));

module.exports = router;
