// Módulo CodeX (editor de páginas para Moodle). Cada usuario de Bravo Hub
// solo ve y edita sus propias páginas; lo ajeno o inexistente responde 404.

const MAX_NOMBRE = 150;
// Mismo umbral que tenía el builder al guardar en localStorage.
const MAX_BLOQUES = 4_000_000;

function httpError(message, status) {
    const err = new Error(message);
    err.status = status;
    return err;
}

const noEncontrado = () => httpError('No encontrado', 404);

function idValido(v) {
    const n = Number(v);
    if (!Number.isInteger(n) || n <= 0) throw noEncontrado();
    return n;
}

function nombreValido(v) {
    const s = typeof v === 'string' ? v.trim() : '';
    if (!s) throw httpError('Escribe un nombre para la página', 400);
    if (s.length > MAX_NOMBRE) throw httpError(`El nombre no puede pasar de ${MAX_NOMBRE} caracteres`, 400);
    return s;
}

function bloquesJson(v) {
    if (!Array.isArray(v)) throw httpError('Los bloques deben ser una lista', 400);
    const json = JSON.stringify(v);
    if (json.length > MAX_BLOQUES) throw httpError('La página es demasiado grande para guardar', 413);
    return json;
}

module.exports = function createController(data) {
    async function getActor(email) {
        const users = await data.findPlatformUserByEmail(email);
        if (!users[0]) throw httpError('Usuario de Bravo Hub no encontrado', 403);
        return { userId: users[0].id, email };
    }

    async function propia(actor, id) {
        const p = await data.codex.getPagina(idValido(id));
        if (!p || p.platform_user_id !== actor.userId) throw noEncontrado();
        return p;
    }

    const listPaginas = (actor) => data.codex.listPaginas(actor.userId);

    async function createPagina(actor, body = {}) {
        const nombre = nombreValido(body.nombre);
        return data.codex.insertPagina(actor.userId, nombre, bloquesJson(body.bloques ?? []));
    }

    async function getPagina(actor, id) {
        const p = await propia(actor, id);
        return { id: p.id, nombre: p.nombre, bloques: p.bloques, created_at: p.created_at, updated_at: p.updated_at };
    }

    async function updatePagina(actor, id, body = {}) {
        const p = await propia(actor, id);
        const nombre = body.nombre !== undefined ? nombreValido(body.nombre) : null;
        const bloques = body.bloques !== undefined ? bloquesJson(body.bloques) : null;
        if (nombre === null && bloques === null) throw httpError('No hay cambios para guardar', 400);
        return data.codex.updatePagina(p.id, nombre, bloques);
    }

    async function duplicarPagina(actor, id) {
        const p = await propia(actor, id);
        const nombre = `${p.nombre} (copia)`.slice(0, MAX_NOMBRE);
        return data.codex.insertPagina(actor.userId, nombre, JSON.stringify(p.bloques));
    }

    async function deletePagina(actor, id) {
        const p = await propia(actor, id);
        await data.codex.deletePagina(p.id);
        return { id: p.id, nombre: p.nombre };
    }

    return { getActor, listPaginas, createPagina, getPagina, updatePagina, duplicarPagina, deletePagina };
};
