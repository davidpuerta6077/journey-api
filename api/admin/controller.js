module.exports = (injectedDB) => {
    let data = injectedDB;
    if (!data) data = require('../../database/postgresql');

    // ─── PLATFORM USERS ─────────────────────────────────────────────────────────

    async function listUsuarios() {
        return data.listPlatformUsers();
    }

    async function createUsuario(body, createdBy) {
        const { username, email, role_id } = body;
        const existing = await data.findPlatformUser(email, username);
        if (existing.length > 0) {
            const err = new Error('Ya existe un usuario de plataforma con ese email o username');
            err.status = 409;
            throw err;
        }
        const result = await data.insertPlatformUser({ username, email, role_id, created_by: createdBy || null });
        return result[0];
    }

    async function updateUsuario(id, body) {
        const { username, role_id } = body;
        const result = await data.updatePlatformUser(id, { username, role_id });
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

    return {
        listUsuarios, createUsuario, updateUsuario, setUsuarioEstado,
        listRoles, createRole, updateRole,
        listModulos, createModulo, updateModulo,
        listSubmodulos, createSubmodulo, updateSubmodulo,
        getPermisosMatrix, grantPermiso, revokePermiso
    };
};
