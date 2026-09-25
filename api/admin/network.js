const { Router } = require('express');
const router = Router();
const response = require('../../network/response');
const ctrl = require('./index');
const postgresql = require('../../database/postgresql');
const checkAuth = require('../../middleware/checkAuth');
const checkPermission = require('../../middleware/checkPermissions');
const saveLog = require('../../middleware/saveLog');

// ─── USUARIOS DE PLATAFORMA ─────────────────────────────────────────────────────

/**
 * @swagger
 * /admin/usuarios:
 *   get:
 *     summary: Listar usuarios de la plataforma (Bravo Hub, no Moodle)
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
 *               departamento: { type: string }
 *     responses:
 *       200: { description: Usuario de plataforma creado }
 *       409: { description: Ya existe un usuario con ese email o username }
 */
router.post('/usuarios', checkAuth, checkPermission('admin_users'), saveLog('admin_users', {
    descripcion: (req) => `Creó el usuario de plataforma "${req.body?.username || '—'}" (${req.body?.email || '—'}) con rol ${req._logRole?.name || req.body?.role_id}`,
    detalle: (req) => [{ username: req.body?.username, email: req.body?.email, rol: req._logRole?.name, departamento: req.body?.departamento }],
}), async (req, res, next) => {
    try {
        req._logRole = req.body?.role_id ? await postgresql.getRoleById(req.body.role_id) : null;
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
 *               departamento: { type: string }
 *     responses:
 *       200: { description: Usuario de plataforma actualizado }
 */
router.put('/usuarios/:id', checkAuth, checkPermission('admin_users'), saveLog('admin_users', {
    descripcion: (req) => `Actualizó el usuario de plataforma "${req.body?.username || req.params.id}"${req._logRole ? ` (rol: ${req._logRole.name})` : ''}`,
    entityId: (req) => req.params.id,
    detalle: (req) => [{ username: req.body?.username, rol: req._logRole?.name, departamento: req.body?.departamento }],
}), async (req, res, next) => {
    try {
        req._logRole = req.body?.role_id ? await postgresql.getRoleById(req.body.role_id) : null;
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
router.post('/usuarios/:id/estado', checkAuth, checkPermission('admin_users'), saveLog('admin_users', {
    descripcion: (req) => `${req.body?.estado ? 'Activó' : 'Desactivó'} a "${req._logUser?.username || req._logUser?.email || `id ${req.params.id}`}"`,
    entityId: (req) => req.params.id,
    detalle: (req) => [{ id: req.params.id, username: req._logUser?.username, email: req._logUser?.email, estado: req.body?.estado }],
}), async (req, res, next) => {
    try {
        const result = await ctrl.setUsuarioEstado(req.params.id, !!req.body.estado);
        req._logUser = result;
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
router.post('/roles', checkAuth, checkPermission('admin_roles'), saveLog('admin_roles', {
    descripcion: (req) => `Creó el rol "${req.body?.name || '—'}"`,
    detalle: (req) => [{ name: req.body?.name, description: req.body?.description }],
}), async (req, res, next) => {
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
router.put('/roles/:id', checkAuth, checkPermission('admin_roles'), saveLog('admin_roles', {
    descripcion: (req) => `Actualizó el rol "${req.body?.name || req.params.id}"`,
    entityId: (req) => req.params.id,
}), async (req, res, next) => {
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
router.post('/modulos', checkAuth, checkPermission('admin_modules'), saveLog('admin_modules', {
    descripcion: (req) => `Creó el módulo "${req.body?.name || req.body?.code || '—'}"`,
    detalle: (req) => [{ code: req.body?.code, name: req.body?.name }],
}), async (req, res, next) => {
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
router.put('/modulos/:id', checkAuth, checkPermission('admin_modules'), saveLog('admin_modules', {
    descripcion: (req) => `Actualizó el módulo "${req.body?.name || req.params.id}"`,
    entityId: (req) => req.params.id,
}), async (req, res, next) => {
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
router.post('/submodulos', checkAuth, checkPermission('admin_modules'), saveLog('admin_modules', {
    descripcion: (req) => `Creó el submódulo "${req.body?.name || req.body?.code || '—'}" en el módulo "${req._logModule?.name || req.body?.module_id}"`,
    detalle: (req) => [{ code: req.body?.code, name: req.body?.name, modulo: req._logModule?.name }],
}), async (req, res, next) => {
    try {
        req._logModule = req.body?.module_id ? await postgresql.getModuleById(req.body.module_id) : null;
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
router.put('/submodulos/:id', checkAuth, checkPermission('admin_modules'), saveLog('admin_modules', {
    descripcion: (req) => `Actualizó el submódulo "${req.body?.name || req.params.id}"`,
    entityId: (req) => req.params.id,
}), async (req, res, next) => {
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
router.post('/reglas', checkAuth, checkPermission('rules_active'), saveLog('rules_active', {
    descripcion: (req) => `Creó regla de sincronización para "${req.body?.codigo_asignatura || req.body?.programa || req.body?.departamento || '—'}" -> semilla "${req.body?.seed_shortname || '—'}"`,
    detalle: (req) => [{ codigo_asignatura: req.body?.codigo_asignatura, programa: req.body?.programa, departamento: req.body?.departamento, seed_shortname: req.body?.seed_shortname, categoryid: req.body?.categoryid }],
}), async (req, res, next) => {
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
router.put('/reglas/:id', checkAuth, checkPermission('rules_active'), saveLog('rules_active', {
    descripcion: (req) => `Actualizó la regla para "${req.body?.codigo_asignatura || req.body?.programa || req.body?.departamento || '—'}" -> semilla "${req.body?.seed_shortname || '—'}"`,
    entityId: (req) => req.params.id,
    detalle: (req) => [{ codigo_asignatura: req.body?.codigo_asignatura, programa: req.body?.programa, departamento: req.body?.departamento, seed_shortname: req.body?.seed_shortname, activo: req.body?.activo }],
}), async (req, res, next) => {
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
router.delete('/reglas/:id', checkAuth, checkPermission('rules_active'), saveLog('rules_active', {
    descripcion: (req) => {
        const r = req._logRegla;
        return `Eliminó la regla para "${r?.codigo_asignatura || r?.programa || r?.departamento || `id ${req.params.id}`}" (semilla "${r?.seed_shortname || '—'}")`;
    },
    entityId: (req) => req.params.id,
    detalle: (req) => [{ codigo_asignatura: req._logRegla?.codigo_asignatura, programa: req._logRegla?.programa, departamento: req._logRegla?.departamento, seed_shortname: req._logRegla?.seed_shortname }],
}), async (req, res, next) => {
    try {
        const rows = await postgresql.findSyncRuleById(req.params.id);
        req._logRegla = rows[0] || null;
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

/**
 * @swagger
 * /admin/moodle_categorias:
 *   post:
 *     summary: Crear una categoría nueva en Moodle (para usarla como destino de una regla)
 *     tags: [Admin]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name:   { type: string }
 *               parent: { type: integer, description: "categoryid padre (0 = raíz)" }
 *     responses:
 *       200: { description: Categoría creada }
 */
router.post('/moodle_categorias', checkAuth, checkPermission('rules_active'), async (req, res, next) => {
    try {
        const result = await ctrl.createMoodleCategoria(req.body);
        response.success(req, res, result, 200);
    } catch (error) {
        next(error);
    }
});

/**
 * @swagger
 * /admin/asignaturas:
 *   get:
 *     summary: Listar códigos y nombres de asignatura ya vistos en cursos sincronizados (para el buscador del formulario de reglas)
 *     tags: [Admin]
 *     responses:
 *       200: { description: Lista de asignaturas }
 */
router.get('/asignaturas', checkAuth, checkPermission('rules_active'), async (req, res, next) => {
    try {
        const result = await ctrl.listAsignaturas();
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
router.post('/permisos/grant', checkAuth, checkPermission('admin_permissions'), saveLog('admin_permissions', {
    descripcion: (req) => `Otorgó "${req._logSubmodule?.name || req.body?.submodule_id}" al rol "${req._logRole?.name || req.body?.role_id}"`,
    detalle: (req) => [{ rol: req._logRole?.name, submodulo: req._logSubmodule?.name }],
}), async (req, res, next) => {
    try {
        [req._logRole, req._logSubmodule] = await Promise.all([
            postgresql.getRoleById(req.body?.role_id),
            postgresql.getSubmoduleById(req.body?.submodule_id),
        ]);
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
router.post('/permisos/revoke', checkAuth, checkPermission('admin_permissions'), saveLog('admin_permissions', {
    descripcion: (req) => `Revocó "${req._logSubmodule?.name || req.body?.submodule_id}" al rol "${req._logRole?.name || req.body?.role_id}"`,
    detalle: (req) => [{ rol: req._logRole?.name, submodulo: req._logSubmodule?.name }],
}), async (req, res, next) => {
    try {
        [req._logRole, req._logSubmodule] = await Promise.all([
            postgresql.getRoleById(req.body?.role_id),
            postgresql.getSubmoduleById(req.body?.submodule_id),
        ]);
        const result = await ctrl.revokePermiso(req.body);
        response.success(req, res, result, 200);
    } catch (error) {
        next(error);
    }
});

// ─── LOGS ─────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /admin/logs:
 *   get:
 *     summary: Listar registros de auditoría (últimos 300, más recientes primero)
 *     tags: [Admin]
 *     responses:
 *       200: { description: Lista de logs (usuario, aplicación, descripción, fecha) }
 */
router.get('/logs', checkAuth, checkPermission('admin_logs'), async (req, res, next) => {
    try {
        const result = await ctrl.listLogs();
        response.success(req, res, result, 200);
    } catch (error) {
        next(error);
    }
});

module.exports = router;
