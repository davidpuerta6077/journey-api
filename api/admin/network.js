const { Router } = require('express');
const router = Router();
const response = require('../../network/response');
const ctrl = require('./index');
const checkAuth = require('../../middleware/checkAuth');
const checkPermission = require('../../middleware/checkPermissions');

// ─── USUARIOS DE PLATAFORMA ─────────────────────────────────────────────────────

/**
 * @swagger
 * /admin/usuarios:
 *   get:
 *     summary: Listar usuarios de la plataforma (Bravo Suite, no Moodle)
 *     tags: [Admin]
 *     responses:
 *       200: { description: Lista de usuarios de plataforma }
 */
router.get('/usuarios', checkAuth, checkPermission('admin_users'), async (req, res, next) => {
    try {
        const result = await ctrl.listUsuarios();
        response.success(req, res, result, 200);
    } catch (error) {
        next(error);
    }
});

/**
 * @swagger
 * /admin/usuarios:
 *   post:
 *     summary: Crear usuario de plataforma
 *     tags: [Admin]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [username, email, role_id]
 *             properties:
 *               username: { type: string }
 *               email:    { type: string }
 *               role_id:  { type: integer }
 *     responses:
 *       200: { description: Usuario de plataforma creado }
 *       409: { description: Ya existe un usuario con ese email o username }
 */
router.post('/usuarios', checkAuth, checkPermission('admin_users'), async (req, res, next) => {
    try {
        const result = await ctrl.createUsuario(req.body, null);
        response.success(req, res, result, 200);
    } catch (error) {
        next(error);
    }
});

/**
 * @swagger
 * /admin/usuarios/{id}:
 *   put:
 *     summary: Editar usuario de plataforma
 *     tags: [Admin]
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
 *             properties:
 *               username: { type: string }
 *               role_id:  { type: integer }
 *     responses:
 *       200: { description: Usuario de plataforma actualizado }
 */
router.put('/usuarios/:id', checkAuth, checkPermission('admin_users'), async (req, res, next) => {
    try {
        const result = await ctrl.updateUsuario(req.params.id, req.body);
        response.success(req, res, result, 200);
    } catch (error) {
        next(error);
    }
});

/**
 * @swagger
 * /admin/usuarios/{id}/estado:
 *   post:
 *     summary: Activar o desactivar un usuario de plataforma
 *     tags: [Admin]
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
 *             required: [estado]
 *             properties:
 *               estado: { type: boolean }
 *     responses:
 *       200: { description: Estado actualizado }
 */
router.post('/usuarios/:id/estado', checkAuth, checkPermission('admin_users'), async (req, res, next) => {
    try {
        const result = await ctrl.setUsuarioEstado(req.params.id, !!req.body.estado);
        response.success(req, res, result, 200);
    } catch (error) {
        next(error);
    }
});

// ─── ROLES ──────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /admin/roles:
 *   get:
 *     summary: Listar roles
 *     tags: [Admin]
 *     responses:
 *       200: { description: Lista de roles }
 */
router.get('/roles', checkAuth, checkPermission('admin_roles'), async (req, res, next) => {
    try {
        const result = await ctrl.listRoles();
        response.success(req, res, result, 200);
    } catch (error) {
        next(error);
    }
});

/**
 * @swagger
 * /admin/roles:
 *   post:
 *     summary: Crear rol
 *     tags: [Admin]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name:        { type: string }
 *               description: { type: string }
 *     responses:
 *       200: { description: Rol creado }
 */
router.post('/roles', checkAuth, checkPermission('admin_roles'), async (req, res, next) => {
    try {
        const result = await ctrl.createRole(req.body);
        response.success(req, res, result, 200);
    } catch (error) {
        next(error);
    }
});

/**
 * @swagger
 * /admin/roles/{id}:
 *   put:
 *     summary: Editar rol
 *     tags: [Admin]
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
 *             properties:
 *               name:        { type: string }
 *               description: { type: string }
 *     responses:
 *       200: { description: Rol actualizado }
 */
router.put('/roles/:id', checkAuth, checkPermission('admin_roles'), async (req, res, next) => {
    try {
        const result = await ctrl.updateRole(req.params.id, req.body);
        response.success(req, res, result, 200);
    } catch (error) {
        next(error);
    }
});

// ─── MÓDULOS ──────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /admin/modulos:
 *   get:
 *     summary: Listar módulos de la aplicación
 *     tags: [Admin]
 *     responses:
 *       200: { description: Lista de módulos }
 */
router.get('/modulos', checkAuth, checkPermission('admin_modules'), async (req, res, next) => {
    try {
        const result = await ctrl.listModulos();
        response.success(req, res, result, 200);
    } catch (error) {
        next(error);
    }
});

/**
 * @swagger
 * /admin/modulos:
 *   post:
 *     summary: Crear módulo
 *     tags: [Admin]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [code, name]
 *             properties:
 *               code: { type: string }
 *               name: { type: string }
 *     responses:
 *       200: { description: Módulo creado }
 */
router.post('/modulos', checkAuth, checkPermission('admin_modules'), async (req, res, next) => {
    try {
        const result = await ctrl.createModulo(req.body);
        response.success(req, res, result, 200);
    } catch (error) {
        next(error);
    }
});

/**
 * @swagger
 * /admin/modulos/{id}:
 *   put:
 *     summary: Editar módulo
 *     tags: [Admin]
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
 *             properties:
 *               code: { type: string }
 *               name: { type: string }
 *     responses:
 *       200: { description: Módulo actualizado }
 */
router.put('/modulos/:id', checkAuth, checkPermission('admin_modules'), async (req, res, next) => {
    try {
        const result = await ctrl.updateModulo(req.params.id, req.body);
        response.success(req, res, result, 200);
    } catch (error) {
        next(error);
    }
});

// ─── SUBMÓDULOS ───────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /admin/submodulos:
 *   get:
 *     summary: Listar submódulos (con su módulo padre)
 *     tags: [Admin]
 *     responses:
 *       200: { description: Lista de submódulos }
 */
router.get('/submodulos', checkAuth, checkPermission('admin_modules'), async (req, res, next) => {
    try {
        const result = await ctrl.listSubmodulos();
        response.success(req, res, result, 200);
    } catch (error) {
        next(error);
    }
});

/**
 * @swagger
 * /admin/submodulos:
 *   post:
 *     summary: Crear submódulo
 *     tags: [Admin]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [module_id, code, name]
 *             properties:
 *               module_id: { type: integer }
 *               code:      { type: string }
 *               name:      { type: string }
 *     responses:
 *       200: { description: Submódulo creado }
 */
router.post('/submodulos', checkAuth, checkPermission('admin_modules'), async (req, res, next) => {
    try {
        const result = await ctrl.createSubmodulo(req.body);
        response.success(req, res, result, 200);
    } catch (error) {
        next(error);
    }
});

/**
 * @swagger
 * /admin/submodulos/{id}:
 *   put:
 *     summary: Editar submódulo
 *     tags: [Admin]
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
 *             properties:
 *               module_id: { type: integer }
 *               code:      { type: string }
 *               name:      { type: string }
 *     responses:
 *       200: { description: Submódulo actualizado }
 */
router.put('/submodulos/:id', checkAuth, checkPermission('admin_modules'), async (req, res, next) => {
    try {
        const result = await ctrl.updateSubmodulo(req.params.id, req.body);
        response.success(req, res, result, 200);
    } catch (error) {
        next(error);
    }
});

// ─── REGLAS DE SINCRONIZACIÓN (sync_rules) ─────────────────────────────────────────

/**
 * @swagger
 * /admin/reglas:
 *   get:
 *     summary: Listar reglas de sincronización (programa/departamento/codigo_asignatura → semilla + categoría Moodle)
 *     tags: [Admin]
 *     responses:
 *       200: { description: Lista de reglas }
 */
router.get('/reglas', checkAuth, checkPermission('rules_active'), async (req, res, next) => {
    try {
        const result = await ctrl.listReglas();
        response.success(req, res, result, 200);
    } catch (error) {
        next(error);
    }
});

/**
 * @swagger
 * /admin/reglas:
 *   post:
 *     summary: Crear regla de sincronización
 *     tags: [Admin]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [seed_shortname, categoryid]
 *             properties:
 *               codigo_asignatura: { type: string }
 *               programa:          { type: string }
 *               departamento:      { type: string }
 *               seed_shortname:    { type: string }
 *               categoryid:        { type: integer }
 *               activo:            { type: boolean }
 *     responses:
 *       200: { description: Regla creada }
 *       409: { description: Ya existe una regla activa con esa combinación }
 */
router.post('/reglas', checkAuth, checkPermission('rules_active'), async (req, res, next) => {
    try {
        const result = await ctrl.createRegla(req.body);
        response.success(req, res, result, 200);
    } catch (error) {
        next(error);
    }
});

/**
 * @swagger
 * /admin/reglas/{id}:
 *   put:
 *     summary: Editar regla de sincronización
 *     tags: [Admin]
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
 *             properties:
 *               codigo_asignatura: { type: string }
 *               programa:          { type: string }
 *               departamento:      { type: string }
 *               seed_shortname:    { type: string }
 *               categoryid:        { type: integer }
 *               activo:            { type: boolean }
 *     responses:
 *       200: { description: Regla actualizada }
 *       409: { description: Ya existe otra regla activa con esa combinación }
 */
router.put('/reglas/:id', checkAuth, checkPermission('rules_active'), async (req, res, next) => {
    try {
        const result = await ctrl.updateRegla(req.params.id, req.body);
        response.success(req, res, result, 200);
    } catch (error) {
        next(error);
    }
});

/**
 * @swagger
 * /admin/reglas/{id}:
 *   delete:
 *     summary: Eliminar regla de sincronización
 *     tags: [Admin]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Regla eliminada }
 */
router.delete('/reglas/:id', checkAuth, checkPermission('rules_active'), async (req, res, next) => {
    try {
        const result = await ctrl.deleteRegla(req.params.id);
        response.success(req, res, result, 200);
    } catch (error) {
        next(error);
    }
});

// ─── PLANTILLAS (catálogo en vivo de Moodle: categorías y cursos semilla) ──────────

/**
 * @swagger
 * /admin/moodle_categorias:
 *   get:
 *     summary: Listar categorías de Moodle (en vivo, para elegir categoryid al crear una regla)
 *     tags: [Admin]
 *     responses:
 *       200: { description: Lista de categorías de Moodle }
 */
router.get('/moodle_categorias', checkAuth, checkPermission('rules_templates'), async (req, res, next) => {
    try {
        const result = await ctrl.listMoodleCategorias();
        response.success(req, res, result, 200);
    } catch (error) {
        next(error);
    }
});

/**
 * @swagger
 * /admin/moodle_semillas:
 *   get:
 *     summary: Listar los cursos de la categoría de semillas en Moodle en vivo
 *     tags: [Admin]
 *     parameters:
 *       - in: query
 *         name: categoryid
 *         required: false
 *         schema: { type: integer }
 *         description: "Categoría de Moodle donde viven las semillas (por defecto 1)"
 *     responses:
 *       200: { description: Lista de cursos semilla encontrados en Moodle }
 */
router.get('/moodle_semillas', checkAuth, checkPermission('rules_templates'), async (req, res, next) => {
    try {
        const categoryId = req.query.categoryid ? Number(req.query.categoryid) : undefined;
        const result = await ctrl.listMoodleSemillas(categoryId);
        response.success(req, res, result, 200);
    } catch (error) {
        next(error);
    }
});

// ─── PERMISOS ─────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /admin/permisos:
 *   get:
 *     summary: Obtener la matriz de roles, módulos/submódulos y permisos otorgados
 *     tags: [Admin]
 *     responses:
 *       200: { description: Matriz de permisos }
 */
router.get('/permisos', checkAuth, checkPermission('admin_permissions'), async (req, res, next) => {
    try {
        const result = await ctrl.getPermisosMatrix();
        response.success(req, res, result, 200);
    } catch (error) {
        next(error);
    }
});

/**
 * @swagger
 * /admin/permisos/grant:
 *   post:
 *     summary: Otorgar un submódulo a un rol
 *     tags: [Admin]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [role_id, submodule_id]
 *             properties:
 *               role_id:      { type: integer }
 *               submodule_id: { type: integer }
 *     responses:
 *       200: { description: Permiso otorgado }
 */
router.post('/permisos/grant', checkAuth, checkPermission('admin_permissions'), async (req, res, next) => {
    try {
        const result = await ctrl.grantPermiso(req.body, null);
        response.success(req, res, result, 200);
    } catch (error) {
        next(error);
    }
});

/**
 * @swagger
 * /admin/permisos/revoke:
 *   post:
 *     summary: Revocar un submódulo a un rol
 *     tags: [Admin]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [role_id, submodule_id]
 *             properties:
 *               role_id:      { type: integer }
 *               submodule_id: { type: integer }
 *     responses:
 *       200: { description: Permiso revocado }
 */
router.post('/permisos/revoke', checkAuth, checkPermission('admin_permissions'), async (req, res, next) => {
    try {
        const result = await ctrl.revokePermiso(req.body);
        response.success(req, res, result, 200);
    } catch (error) {
        next(error);
    }
});

module.exports = router;
