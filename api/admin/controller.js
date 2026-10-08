const { moodleRequest } = require('../../services/moodleService');
const { assertMoodleOk } = require('../../services/moodleAssert');

module.exports = (injectedDB) => {
    let data = injectedDB;
    if (!data) data = require('../../database/postgresql');

    // ─── PLATFORM USERS ─────────────────────────────────────────────────────────

    async function listUsuarios() {
        return data.listPlatformUsers();
    }

    async function createUsuario(body, createdBy) {
        const { username, email, role_id, departamento } = body;
        const existing = await data.findPlatformUser(email, username);
        if (existing.length > 0) {
            const err = new Error('Ya existe un usuario de plataforma con ese email o username');
            err.status = 409;
            throw err;
        }
        const result = await data.insertPlatformUser({ username, email, role_id, created_by: createdBy || null, departamento });
        return result[0];
    }

    async function updateUsuario(id, body) {
        const { username, role_id, departamento } = body;
        const result = await data.updatePlatformUser(id, { username, role_id, departamento });
        return result[0];
    }

    async function setUsuarioEstado(id, estado) {
        const result = await data.updatePlatformUserEstado(id, estado);
        return result[0];
    }

    // ─── ROLES ──────────────────────────────────────────────────────────────────

    async function listRoles() {
        return data.listRoles();
    }

    async function createRole(body) {
        const { name, description } = body;
        const result = await data.insertRole({ name, description });
        return result[0];
    }

    async function updateRole(id, body) {
        const { name, description } = body;
        const result = await data.updateRole(id, { name, description });
        return result[0];
    }

    // ─── MODULES ────────────────────────────────────────────────────────────────

    async function listModulos() {
        return data.listModulesAdmin();
    }

    async function createModulo(body) {
        const { code, name } = body;
        const result = await data.insertModuleAdmin({ code, name });
        return result[0];
    }

    async function updateModulo(id, body) {
        const { code, name } = body;
        const result = await data.updateModuleAdmin(id, { code, name });
        return result[0];
    }

    // ─── SUBMODULES ─────────────────────────────────────────────────────────────

    async function listSubmodulos() {
        return data.listSubmodulesAdmin();
    }

    async function createSubmodulo(body) {
        const { module_id, code, name } = body;
        const result = await data.insertSubmoduleAdmin({ module_id, code, name });
        return result[0];
    }

    async function updateSubmodulo(id, body) {
        const { module_id, code, name } = body;
        const result = await data.updateSubmoduleAdmin(id, { module_id, code, name });
        return result[0];
    }

    // ─── SYNC RULES ─────────────────────────────────────────────────────────────

    async function listReglas() {
        return data.listSyncRulesAdmin();
    }

    async function createRegla(body) {
        const { codigo_asignatura, programa, departamento, seed_shortname, categoryid, activo } = body;
        if (!seed_shortname || !categoryid) {
            const err = new Error('seed_shortname y categoryid son obligatorios');
            err.status = 400;
            throw err;
        }
        const existing = await data.findSyncRuleExact(codigo_asignatura, programa, departamento);
        if (existing.length > 0) {
            const err = new Error('Ya existe una regla activa con esa combinación de código/programa/departamento');
            err.status = 409;
            throw err;
        }
        const result = await data.insertSyncRuleAdmin({ codigo_asignatura, programa, departamento, seed_shortname, categoryid, activo });
        return result[0];
    }

    async function updateRegla(id, body) {
        const { codigo_asignatura, programa, departamento, seed_shortname, categoryid, activo } = body;
        if (!seed_shortname || !categoryid) {
            const err = new Error('seed_shortname y categoryid son obligatorios');
            err.status = 400;
            throw err;
        }
        const existing = await data.findSyncRuleExact(codigo_asignatura, programa, departamento, Number(id));
        if (existing.length > 0) {
            const err = new Error('Ya existe otra regla activa con esa combinación de código/programa/departamento');
            err.status = 409;
            throw err;
        }
        const result = await data.updateSyncRuleAdmin(id, { codigo_asignatura, programa, departamento, seed_shortname, categoryid, activo });
        return result[0];
    }

    async function deleteRegla(id) {
        await data.deleteSyncRuleAdmin(id);
        return { id: Number(id), deleted: true };
    }

    // Catálogo en vivo de Moodle (para la pantalla Reglas > Plantillas): no se
    // guarda nada localmente, solo se lee de Moodle para ayudar a llenar el
    // formulario de reglas con valores reales (categoryid y seed_shortname).
    async function listMoodleCategorias() {
        const result = await moodleRequest('core_course_get_categories', {});
        assertMoodleOk(result, 'Error listando categorías de Moodle');
        return result;
    }

    // categoryid de la categoría de Moodle donde viven los cursos semilla.
    // core_course_search_courses no está habilitado en el servicio externo de Moodle,
    // así que se listan por categoría con core_course_get_courses_by_field (la misma
    // función que ya usa syncCourses.js, confirmada habilitada).
    const SEMILLAS_CATEGORY_ID = 1;

    // core_course_get_courses_by_field(field:'category') solo trae cursos que están
    // DIRECTAMENTE en esa categoría, no en sus subcategorías. Para traer también las
    // semillas guardadas en subcategorías, primero se resuelve el árbol de categorías
    // (por su campo "path", ej. "/1/5/12") y se consulta cada una que cuelgue de la
    // categoría raíz.
    async function resolveDescendantCategoryIds(rootCategoryId) {
        const categorias = await listMoodleCategorias();
        return categorias
            .filter(cat => String(cat.path || '').split('/').filter(Boolean).map(Number).includes(rootCategoryId))
            .map(cat => cat.id);
    }

    // Categoría nueva de Moodle, creada directamente desde Nexo al armar una
    // regla (evita que el usuario tenga que ir a Moodle a crearla primero).
    async function createMoodleCategoria(body) {
        const { name, parent } = body;
        if (!name) {
            const err = new Error('El nombre de la categoría es obligatorio');
            err.status = 400;
            throw err;
        }
        const result = await moodleRequest('core_course_create_categories', {
            'categories[0][name]': name,
            'categories[0][parent]': parent || 0
        });
        assertMoodleOk(result, 'Error creando la categoría en Moodle');
        return result?.[0];
    }

    // Catálogo de asignaturas ya vistas en cursos sincronizados, para que el
    // formulario de reglas ofrezca un buscador en vez de pedir el código de memoria.
    async function listAsignaturas() {
        return data.getDistinctAsignaturas();
    }

    async function listMoodleSemillas(categoryId = SEMILLAS_CATEGORY_ID) {
        const categoryIds = await resolveDescendantCategoryIds(categoryId);
        if (!categoryIds.includes(categoryId)) categoryIds.push(categoryId);

        const coursesByCategory = await Promise.all(
            categoryIds.map(id => moodleRequest('core_course_get_courses_by_field', { field: 'category', value: id }))
        );

        const allCourses = [];
        const seenIds = new Set();
        coursesByCategory.forEach(result => {
            assertMoodleOk(result, 'Error buscando cursos semilla en Moodle');
            (result?.courses || []).forEach(course => {
                if (!seenIds.has(course.id)) {
                    seenIds.add(course.id);
                    allCourses.push(course);
                }
            });
        });
        return allCourses;
    }

    // ─── PERMISOS ───────────────────────────────────────────────────────────────

    async function getPermisosMatrix() {
        const [roles, modulesFlat, grants] = await Promise.all([
            data.listRoles(),
            data.listSubmodulesAdmin(),
            data.listRolePermissions()
        ]);

        const modulesMap = new Map();
        for (const row of modulesFlat) {
            if (!modulesMap.has(row.module_id)) {
                modulesMap.set(row.module_id, {
                    module_id: row.module_id,
                    module_code: row.module_code,
                    module_name: row.module_name,
                    submodules: []
                });
            }
            modulesMap.get(row.module_id).submodules.push({
                submodule_id: row.id,
                submodule_code: row.code,
                submodule_name: row.name
            });
        }

        return {
            roles,
            modules: Array.from(modulesMap.values()),
            grants: grants.map(g => ({ role_id: g.role_id, submodule_id: g.submodule_id }))
        };
    }

    async function grantPermiso(body, grantedBy) {
        const { role_id, submodule_id } = body;
        const existing = await data.findRolePermission(role_id, submodule_id);
        if (existing.length > 0) return existing[0];
        const result = await data.grantRolePermission({ role_id, submodule_id, granted_by: grantedBy || null });
        return result[0];
    }

    async function revokePermiso(body) {
        const { role_id, submodule_id } = body;
        await data.revokeRolePermission(role_id, submodule_id);
        return { role_id, submodule_id, revoked: true };
    }

    // ─── LOGS ───────────────────────────────────────────────────────────────────

    async function listLogs() {
        return data.listLogs(300);
    }

    // "Actividad reciente" del Home de Nexo: a diferencia de listLogs (admin_logs),
    // se expone con el permiso nexo_home -- cualquiera que vea esa página ve esto.
    async function listRecentNexoActivity(limit = 8) {
        return data.listRecentLogsByModule('nexo_sync', limit);
    }

    // ─── SETTINGS (apartado Configuración) ───────────────────────────────────────

    async function listSettings(categoria) {
        return data.getSettings(categoria);
    }

    async function saveSetting(body, updatedBy) {
        const { categoria, clave, valor } = body;
        if (!categoria || !clave) {
            const err = new Error('categoria y clave son obligatorios');
            err.status = 400;
            throw err;
        }
        return data.upsertSetting(categoria, clave, valor, updatedBy);
    }

    async function removeSetting(categoria, clave) {
        await data.deleteSetting(categoria, clave);
        return { categoria, clave, deleted: true };
    }

    // Cierre de semestre global (botón en Configuración > Académico): pasa a
    // Finalizado todas las matrículas activas del periodo_actual configurado,
    // sin importar el curso. Igual que el cierre por curso, no llama a
    // Moodle -- la BD externa desmatricula sola en el próximo cron.
    async function finalizePeriodo() {
        const settings = await data.getSettings('academico');
        const periodo = (settings || []).find(s => s.clave === 'periodo_actual')?.valor;
        if (!periodo) {
            const err = new Error('No hay un periodo_actual configurado en Académico');
            err.status = 400;
            throw err;
        }
        const finalizadas = await data.finalizePeriodoEnrollments(periodo);
        return { periodo, finalizadas: finalizadas.length };
    }

    // ─── MENU LINKS (accesos externos editables del sidebar) ─────────────────────

    async function listMenuLinksAdmin() {
        return data.getAllMenuLinks();
    }

    // Consumida por el sidebar: cualquier usuario logueado, solo los activos.
    async function listActiveMenuLinks() {
        return data.getMenuLinks();
    }

    async function createMenuLink(body) {
        const { nombre, url } = body;
        if (!nombre || !url) {
            const err = new Error('nombre y url son obligatorios');
            err.status = 400;
            throw err;
        }
        return data.insertMenuLink(body);
    }

    async function updateMenuLinkAdmin(id, body) {
        const { nombre, url } = body;
        if (!nombre || !url) {
            const err = new Error('nombre y url son obligatorios');
            err.status = 400;
            throw err;
        }
        return data.updateMenuLink(id, body);
    }

    async function deleteMenuLinkAdmin(id) {
        await data.deleteMenuLink(id);
        return { id: Number(id), deleted: true };
    }

    return {
        listUsuarios, createUsuario, updateUsuario, setUsuarioEstado,
        listRoles, createRole, updateRole,
        listModulos, createModulo, updateModulo,
        listSubmodulos, createSubmodulo, updateSubmodulo,
        listReglas, createRegla, updateRegla, deleteRegla,
        listMoodleCategorias, listMoodleSemillas, createMoodleCategoria, listAsignaturas,
        getPermisosMatrix, grantPermiso, revokePermiso,
        listLogs, listRecentNexoActivity,
        listSettings, saveSetting, removeSetting, finalizePeriodo,
        listMenuLinksAdmin, listActiveMenuLinks, createMenuLink, updateMenuLinkAdmin, deleteMenuLinkAdmin
    };
};
