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
