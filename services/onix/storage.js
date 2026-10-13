const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Archivos de evidencia del módulo Informes. Viven en storage/onix (fuera de
// uploads/, que se sirve como estático público) y solo se entregan por el
// endpoint autenticado GET /onix/evidencias/:id/archivo.
const TIPOS = { 'image/jpeg': 'jpg', 'image/png': 'png' };
const MAX_BYTES = 5 * 1024 * 1024;

function httpError(message, status) {
    const err = new Error(message);
    err.status = status;
    return err;
}

function createStorage(baseDir) {
    const base = path.resolve(baseDir);

    function rutaAbsoluta(rel) {
        const abs = path.resolve(base, String(rel));
        if (!abs.startsWith(base + path.sep)) throw httpError('No encontrado', 404);
        return abs;
    }

    async function guardarImagen(userId, file) {
        const ext = TIPOS[file.mimetype];
        if (!ext) throw httpError('Solo se permiten imágenes JPG o PNG', 400);
        if (file.size > MAX_BYTES) throw httpError('La imagen supera 5 MB', 400);
        const dir = path.join(base, String(userId));
        await fs.promises.mkdir(dir, { recursive: true });
        const nombre = `${Date.now()}_${crypto.randomBytes(4).toString('hex')}.${ext}`;
        await file.mv(path.join(dir, nombre));
        return `${userId}/${nombre}`;
    }

    async function leer(rel) {
        return fs.promises.readFile(rutaAbsoluta(rel));
    }

    async function borrar(rel) {
        const abs = rutaAbsoluta(rel);
        await fs.promises.unlink(abs).catch((e) => { if (e.code !== 'ENOENT') throw e; });
    }

    function extension(rel) {
        return path.extname(String(rel)).toLowerCase() === '.png' ? 'png' : 'jpg';
    }

    return { guardarImagen, rutaAbsoluta, leer, borrar, extension };
}

module.exports = createStorage(path.join(__dirname, '../../storage/onix'));
module.exports.createStorage = createStorage;
