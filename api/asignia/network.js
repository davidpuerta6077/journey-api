const fs = require('fs');
const path = require('path');
const { Router } = require('express');
const router = Router();
const response = require('../../network/response');
const ctrl = require('./index');
const { SUBMODULE } = require('./controller');

// Permisos (submódulos del módulo asignia, se asignan en Administrador > Permisos):
//  - asignia_view:   solo consulta.
//  - asignia_load:   consulta + carga de programación y profesores.
//  - asignia_manage: todo, incluido asignar, rechazar y liberar cursos.
// Los logs siguen saliendo con entity_type = asignia_manage (SUBMODULE).
const VER = ['asignia_view', 'asignia_load', SUBMODULE];
const CARGAR = ['asignia_load', SUBMODULE];
const DECIDIR = SUBMODULE;
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
router.get('/cursos', checkAuth, checkPermission(VER), run((req) => ctrl.listarCursos(req.query.periodo)));

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
router.post('/cargar', checkAuth, checkPermission(CARGAR), saveLog(SUBMODULE, {
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
 * /asignia/profesores:
 *   get: { summary: Base de profesores de Asignia, tags: [Asignia] }
 * /asignia/profesores/cargar:
 *   post:
 *     summary: Cargar la base de profesores (pestaña "BD Profesores"; columnas Identificación/Documento, Profesor, Correo institucional, Vinculación). Campo "archivo"
 *     tags: [Asignia]
 */
router.get('/profesores', checkAuth, checkPermission(VER), run(() => ctrl.listarProfesores()));

/**
 * @swagger
 * /asignia/profesores:
 *   post: { summary: "Crear un profesor en la base ({ documento, nombre, correo, vinculacion })", tags: [Asignia] }
 * /asignia/profesores/{id}:
 *   put: { summary: Editar un profesor de la base, tags: [Asignia] }
 *   delete: { summary: Quitar un profesor de la base (no toca sus cursos ni postulaciones), tags: [Asignia] }
 */
/**
 * @swagger
 * /asignia/cursos:
 *   post: { summary: "Crear un curso en la programación ({ periodo, codigo, curso, ..., horario[], profesor_* })", tags: [Asignia] }
 * /asignia/cursos/{id}:
 *   put: { summary: Editar un curso (si cambia el profesor queda "Asignado" y se limpia la verificación), tags: [Asignia] }
 *   delete: { summary: Borrar un curso de la programación (y sus postulaciones), tags: [Asignia] }
 */
const datosLogCurso = (c) => c && {
    periodo: c.periodo, codigo: c.codigo, curso: c.curso, grupo: c.grupo || '—', sede: c.sede || '—',
    programa: c.programa || '—', jornada: c.jornada || '—', profesor: c.profesor_nombre || '—',
    estado: ESTADO[c.verificacion] || c.verificacion,
};

router.post('/cursos', checkAuth, checkPermission(CARGAR), saveLog(SUBMODULE, {
    descripcion: (req) => `Creó el curso ${req._logCurso?.codigo || ''} ${req._logCurso?.curso || ''} en Asignia`,
    entityId: (req) => req._logCurso?.id,
    detalle: (req) => datosLogCurso(req._logCurso),
}), run(async (req) => {
    req._logCurso = await ctrl.crearCurso(req.body);
    return req._logCurso;
}));

router.put('/cursos/:id', checkAuth, checkPermission(CARGAR), saveLog(SUBMODULE, {
    descripcion: (req) => `Editó el curso ${req._logCurso?.despues.codigo || ''} ${req._logCurso?.despues.curso || ''} en Asignia`,
    entityId: (req) => req.params.id,
    detalle: (req) => req._logCurso ? { antes: datosLogCurso(req._logCurso.antes), despues: datosLogCurso(req._logCurso.despues) } : null,
}), run(async (req) => {
    req._logCurso = await ctrl.actualizarCurso(req.params.id, req.body);
    return req._logCurso.despues;
}));

router.delete('/cursos/:id', checkAuth, checkPermission(CARGAR), saveLog(SUBMODULE, {
    descripcion: (req) => `Borró el curso ${req._logCurso?.codigo || ''} ${req._logCurso?.curso || ''} de Asignia`,
    entityId: (req) => req.params.id,
    detalle: (req) => datosLogCurso(req._logCurso),
}), run(async (req) => {
    req._logCurso = await ctrl.borrarCurso(req.params.id);
    return { ok: true };
}));

const datosLogProfesor = (p) => p && { documento: p.documento, nombre: p.nombre, correo: p.correo, vinculacion: p.vinculacion || '—' };

router.post('/profesores', checkAuth, checkPermission(CARGAR), saveLog(SUBMODULE, {
    descripcion: (req) => `Creó el profesor ${req._logProf?.nombre || ''} en Asignia`,
    entityId: (req) => req._logProf?.id,
    detalle: (req) => datosLogProfesor(req._logProf),
}), run(async (req) => {
    req._logProf = await ctrl.crearProfesor(req.body);
    return req._logProf;
}));

router.put('/profesores/:id', checkAuth, checkPermission(CARGAR), saveLog(SUBMODULE, {
    descripcion: (req) => `Editó el profesor ${req._logProf?.despues.nombre || ''} en Asignia`,
    entityId: (req) => req.params.id,
    detalle: (req) => req._logProf ? { antes: datosLogProfesor(req._logProf.antes), despues: datosLogProfesor(req._logProf.despues) } : null,
}), run(async (req) => {
    req._logProf = await ctrl.actualizarProfesor(req.params.id, req.body);
    return req._logProf.despues;
}));

router.delete('/profesores/:id', checkAuth, checkPermission(CARGAR), saveLog(SUBMODULE, {
    descripcion: (req) => `Quitó el profesor ${req._logProf?.nombre || ''} de la base de Asignia`,
    entityId: (req) => req.params.id,
    detalle: (req) => datosLogProfesor(req._logProf),
}), run(async (req) => {
    req._logProf = await ctrl.borrarProfesor(req.params.id);
    return { ok: true };
}));

router.post('/profesores/cargar', checkAuth, checkPermission(CARGAR), saveLog(SUBMODULE, {
    descripcion: () => 'Cargó la base de profesores en Asignia',
    detalle: (req) => req._logResumen ? { archivo: req._logArchivo, ...req._logResumen } : null,
}), async (req, res, next) => {
    const archivo = req.files?.archivo;
    try {
        if (!archivo) throw Object.assign(new Error('Adjunta el archivo de profesores (.xlsx)'), { status: 400 });
        if (path.extname(archivo.name || '').toLowerCase() !== '.xlsx') {
            throw Object.assign(new Error('El archivo debe ser un Excel .xlsx'), { status: 400 });
        }
        const resumen = await ctrl.cargarProfesores(archivo.tempFilePath);
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
 * /asignia/postulaciones/{id}/rechazar:
 *   post: { summary: Rechazar una postulación pendiente (si era la última, el curso vuelve a vacío), tags: [Asignia] }
 */
router.get('/cursos/:id/postulaciones', checkAuth, checkPermission(VER),
    run((req) => ctrl.listarPostulaciones(req.params.id)));

router.post('/cursos/:id/liberar', checkAuth, checkPermission(DECIDIR), saveLog(SUBMODULE, {
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

router.post('/postulaciones/:id/aprobar', checkAuth, checkPermission(DECIDIR), saveLog(SUBMODULE, {
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

router.post('/postulaciones/:id/rechazar', checkAuth, checkPermission(DECIDIR), saveLog(SUBMODULE, {
    descripcion: (req) => `Rechazó la postulación de ${req._logRech?.nombre || ''} en Asignia`,
    entityId: (req) => req.params.id,
    detalle: (req) => req._logRech ? {
        profesor: req._logRech.nombre, documento: req._logRech.documento, correo: req._logRech.correo,
        codigo: req._logRech.codigo, curso: req._logRech.curso, grupo: req._logRech.grupo, periodo: req._logRech.periodo,
    } : null,
}), run(async (req) => {
    const p = await ctrl.rechazarPostulacion(req.params.id);
    req._logRech = p;
    return { ok: true };
}));

module.exports = router;
