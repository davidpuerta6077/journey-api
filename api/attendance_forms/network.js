const { Router } = require('express');
const router = Router();
const response = require('../../network/response');
const ctrl = require('./index');
const postgresql = require('../../database/postgresql');
const checkAuth = require('../../middleware/checkAuth');
const checkPermission = require('../../middleware/checkPermissions');
const saveLog = require('../../middleware/saveLog');

const SUBMODULE = 'attendance_forms_manage';

async function getUserId(req) {
    const users = await postgresql.findPlatformUserByEmail(req.user.email);
    if (!users[0]) {
        const err = new Error('Usuario de plataforma no encontrado');
        err.status = 403;
        throw err;
    }
    return users[0].id;
}

// Para lectura (listar, ver detalle, inscritos, exportar): además del id del
// usuario, si tiene el permiso "ver todos" puede ver formularios de otros.
async function getActor(req) {
    const userId = await getUserId(req);
    const check = await postgresql.checkSubmodulesPermissionsData(req.user.email, 'attendance_forms_view_all');
    const canViewAll = check[0] ? check[0]['?column?'] !== 0 : false;
    return { userId, canViewAll };
}

// ─── FORMULARIOS ────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /forms:
 *   get:
 *     summary: Listar mis formularios de asistencia
 *     tags: [AttendanceForms]
 *     responses:
 *       200: { description: Lista de formularios del usuario autenticado }
 */
router.get('/', checkAuth, checkPermission(SUBMODULE), async (req, res, next) => {
    try {
        const actor = await getActor(req);
        const result = await ctrl.listVisibleForms(actor);
        response.success(req, res, result, 200);
    } catch (error) {
        next(error);
    }
});

/**
 * @swagger
 * /forms/users/search:
 *   get:
 *     summary: Buscar usuarios de plataforma por nombre de usuario o correo (para compartir un formulario)
 *     tags: [AttendanceForms]
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Usuarios que coinciden con la búsqueda }
 */
router.get('/users/search', checkAuth, checkPermission(SUBMODULE), async (req, res, next) => {
    try {
        const result = await ctrl.searchUsers(req.query.q);
        response.success(req, res, result, 200);
    } catch (error) {
        next(error);
    }
});

/**
 * @swagger
 * /forms/{id}:
 *   get:
 *     summary: Obtener un formulario (propio, compartido, o cualquiera si tiene el permiso "ver todos") con sus preguntas
 *     tags: [AttendanceForms]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Formulario con preguntas }
 *       403: { description: Sin acceso a este formulario }
 */
router.get('/:id', checkAuth, checkPermission(SUBMODULE), async (req, res, next) => {
    try {
        const actor = await getActor(req);
        const result = await ctrl.getFormDetail(req.params.id, actor);
        response.success(req, res, result, 200);
    } catch (error) {
        next(error);
    }
});

/**
 * @swagger
 * /forms:
 *   post:
 *     summary: Crear formulario de asistencia (borrador)
 *     tags: [AttendanceForms]
 *     responses:
 *       200: { description: Formulario creado }
 */
router.post('/', checkAuth, checkPermission(SUBMODULE), saveLog(SUBMODULE, {
    descripcion: (req) => `Creó el formulario "${req.body?.title || '—'}"`,
    detalle: (req) => [{ title: req.body?.title }],
}), async (req, res, next) => {
    try {
        const userId = await getUserId(req);
        const result = await ctrl.createForm(userId, req.body);
        response.success(req, res, result, 200);
    } catch (error) {
        next(error);
    }
});

/**
 * @swagger
 * /forms/{id}:
 *   put:
 *     summary: Editar formulario y sus preguntas
 *     tags: [AttendanceForms]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Formulario actualizado }
 */
router.put('/:id', checkAuth, checkPermission(SUBMODULE), saveLog(SUBMODULE, {
    descripcion: (req) => `Actualizó el formulario "${req.body?.title || req.params.id}"`,
    entityId: (req) => req.params.id,
}), async (req, res, next) => {
    try {
        const userId = await getUserId(req);
        const result = await ctrl.updateForm(req.params.id, userId, req.body);
        response.success(req, res, result, 200);
    } catch (error) {
        next(error);
    }
});

/**
 * @swagger
 * /forms/{id}:
 *   delete:
 *     summary: Eliminar (borrado lógico) un formulario propio
 *     tags: [AttendanceForms]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Formulario eliminado }
 */
router.delete('/:id', checkAuth, checkPermission(SUBMODULE), saveLog(SUBMODULE, {
    descripcion: (req) => `Eliminó el formulario "${req._logForm?.title || req.params.id}"`,
    entityId: (req) => req.params.id,
}), async (req, res, next) => {
    try {
        const userId = await getUserId(req);
        const result = await ctrl.removeForm(req.params.id, userId);
        req._logForm = result;
        response.success(req, res, result, 200);
    } catch (error) {
        next(error);
    }
});

/**
 * @swagger
 * /forms/{id}/publish:
 *   post:
 *     summary: Publicar un formulario (genera el link público si no existe)
 *     tags: [AttendanceForms]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Formulario publicado }
 *       400: { description: El formulario no tiene una pregunta de tipo correo o número }
 */
router.post('/:id/publish', checkAuth, checkPermission(SUBMODULE), saveLog(SUBMODULE, {
    descripcion: (req) => `Publicó el formulario id ${req.params.id}`,
    entityId: (req) => req.params.id,
}), async (req, res, next) => {
    try {
        const userId = await getUserId(req);
        const result = await ctrl.publishForm(req.params.id, userId);
        response.success(req, res, result, 200);
    } catch (error) {
        next(error);
    }
});

/**
 * @swagger
 * /forms/{id}/close:
 *   post:
 *     summary: Cerrar un formulario (deja de aceptar registros)
 *     tags: [AttendanceForms]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Formulario cerrado }
 */
router.post('/:id/close', checkAuth, checkPermission(SUBMODULE), saveLog(SUBMODULE, {
    descripcion: (req) => `Cerró el formulario id ${req.params.id}`,
    entityId: (req) => req.params.id,
}), async (req, res, next) => {
    try {
        const userId = await getUserId(req);
        const result = await ctrl.closeForm(req.params.id, userId);
        response.success(req, res, result, 200);
    } catch (error) {
        next(error);
    }
});

/**
 * @swagger
 * /forms/{id}/reopen:
 *   post:
 *     summary: Reabrir un formulario cerrado
 *     tags: [AttendanceForms]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Formulario reabierto }
 */
router.post('/:id/reopen', checkAuth, checkPermission(SUBMODULE), saveLog(SUBMODULE, {
    descripcion: (req) => `Reabrió el formulario id ${req.params.id}`,
    entityId: (req) => req.params.id,
}), async (req, res, next) => {
    try {
        const userId = await getUserId(req);
        const result = await ctrl.reopenForm(req.params.id, userId);
        response.success(req, res, result, 200);
    } catch (error) {
        next(error);
    }
});

/**
 * @swagger
 * /forms/{id}/duplicate:
 *   post:
 *     summary: Duplicar un formulario (crea una copia en borrador)
 *     tags: [AttendanceForms]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Copia del formulario creada }
 */
router.post('/:id/duplicate', checkAuth, checkPermission(SUBMODULE), saveLog(SUBMODULE, {
    descripcion: (req) => `Duplicó el formulario id ${req.params.id}`,
    entityId: (req) => req.params.id,
}), async (req, res, next) => {
    try {
        const userId = await getUserId(req);
        const result = await ctrl.duplicateForm(req.params.id, userId);
        response.success(req, res, result, 200);
    } catch (error) {
        next(error);
    }
});

/**
 * @swagger
 * /forms/{id}/regenerate-link:
 *   post:
 *     summary: Regenerar el link público (invalida el anterior)
 *     tags: [AttendanceForms]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Nuevo token generado }
 */
router.post('/:id/regenerate-link', checkAuth, checkPermission(SUBMODULE), saveLog(SUBMODULE, {
    descripcion: (req) => `Regeneró el link del formulario id ${req.params.id}`,
    entityId: (req) => req.params.id,
}), async (req, res, next) => {
    try {
        const userId = await getUserId(req);
        const result = await ctrl.regenerateLink(req.params.id, userId);
        response.success(req, res, result, 200);
    } catch (error) {
        next(error);
    }
});

// ─── INSCRITOS (RESPUESTAS) ─────────────────────────────────────────────────────

/**
 * @swagger
 * /forms/{id}/responses:
 *   get:
 *     summary: Listar los inscritos de un formulario propio
 *     tags: [AttendanceForms]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Preguntas y respuestas registradas }
 */
router.get('/:id/responses', checkAuth, checkPermission(SUBMODULE), async (req, res, next) => {
    try {
        const actor = await getActor(req);
        const result = await ctrl.listResponses(req.params.id, actor);
        response.success(req, res, result, 200);
    } catch (error) {
        next(error);
    }
});

/**
 * @swagger
 * /forms/{id}/responses/{responseId}:
 *   delete:
 *     summary: Eliminar un registro individual de inscripción
 *     tags: [AttendanceForms]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *       - in: path
 *         name: responseId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Registro eliminado }
 */
router.delete('/:id/responses/:responseId', checkAuth, checkPermission(SUBMODULE), saveLog(SUBMODULE, {
    descripcion: (req) => `Eliminó el registro ${req.params.responseId} del formulario ${req.params.id}`,
    entityId: (req) => req.params.id,
}), async (req, res, next) => {
    try {
        const userId = await getUserId(req);
        const result = await ctrl.removeResponse(req.params.id, req.params.responseId, userId);
        response.success(req, res, result, 200);
    } catch (error) {
        next(error);
    }
});

/**
 * @swagger
 * /forms/{id}/export:
 *   get:
 *     summary: Descargar las respuestas del formulario en Excel
 *     tags: [AttendanceForms]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Archivo .xlsx con todas las respuestas }
 */
router.get('/:id/export', checkAuth, checkPermission(SUBMODULE), async (req, res, next) => {
    try {
        const actor = await getActor(req);
        const { workbook, filename } = await ctrl.exportResponsesWorkbook(req.params.id, actor);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        next(error);
    }
});

/**
 * @swagger
 * /forms/{id}/export/pdf:
 *   get:
 *     summary: Descargar las respuestas del formulario en PDF (mismas columnas que el Excel)
 *     tags: [AttendanceForms]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Archivo .pdf con todas las respuestas }
 */
router.get('/:id/export/pdf', checkAuth, checkPermission(SUBMODULE), async (req, res, next) => {
    try {
        const actor = await getActor(req);
        const { doc, filename } = await ctrl.exportResponsesPdf(req.params.id, actor);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        doc.pipe(res);
        doc.end();
    } catch (error) {
        next(error);
    }
});

// ─── COMPARTIR CON OTROS USUARIOS DE PLATAFORMA ─────────────────────────────────

/**
 * @swagger
 * /forms/{id}/shares:
 *   get:
 *     summary: Listar con quién se compartió un formulario propio
 *     tags: [AttendanceForms]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Usuarios con los que se compartió }
 */
router.get('/:id/shares', checkAuth, checkPermission(SUBMODULE), async (req, res, next) => {
    try {
        const userId = await getUserId(req);
        const result = await ctrl.listShares(req.params.id, userId);
        response.success(req, res, result, 200);
    } catch (error) {
        next(error);
    }
});

/**
 * @swagger
 * /forms/{id}/shares:
 *   post:
 *     summary: Compartir un formulario propio con otro usuario de plataforma
 *     tags: [AttendanceForms]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [user_id]
 *             properties:
 *               user_id: { type: integer }
 *     responses:
 *       200: { description: Formulario compartido }
 */
router.post('/:id/shares', checkAuth, checkPermission(SUBMODULE), saveLog(SUBMODULE, {
    descripcion: (req) => `Compartió el formulario id ${req.params.id} con el usuario "${req._logShareTarget?.username || req.body?.user_id}"`,
    entityId: (req) => req.params.id,
}), async (req, res, next) => {
    try {
        const userId = await getUserId(req);
        req._logShareTarget = await postgresql.getPlatformUserById(req.body?.user_id);
        const result = await ctrl.addShare(req.params.id, userId, req.body?.user_id);
        response.success(req, res, result, 200);
    } catch (error) {
        next(error);
    }
});

/**
 * @swagger
 * /forms/{id}/shares/{userId}:
 *   delete:
 *     summary: Quitar a un usuario de los compartidos de un formulario propio
 *     tags: [AttendanceForms]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Formulario ya no compartido con ese usuario }
 */
router.delete('/:id/shares/:userId', checkAuth, checkPermission(SUBMODULE), saveLog(SUBMODULE, {
    descripcion: (req) => `Quitó al usuario id ${req.params.userId} de los compartidos del formulario ${req.params.id}`,
    entityId: (req) => req.params.id,
}), async (req, res, next) => {
    try {
        const userId = await getUserId(req);
        const result = await ctrl.removeShare(req.params.id, userId, req.params.userId);
        response.success(req, res, result, 200);
    } catch (error) {
        next(error);
    }
});

module.exports = router;
