const fs = require('fs');

// Imágenes de evidencia del módulo Informes. Se guardan en la BD (bytea, tabla
// onix_archivos) porque el disco del contenedor (App Runner) no persiste entre
// despliegues. La referencia que queda en onix_evidencias.contenido es el id.
// Solo se entregan por el endpoint autenticado GET /onix/evidencias/:id/archivo.
const TIPOS = { 'image/jpeg': 'jpg', 'image/png': 'png' };
const MAX_BYTES = 5 * 1024 * 1024;

function httpError(message, status) {
    const err = new Error(message);
    err.status = status;
    return err;
}

function createStorage(injectedDB) {
    const db = () => injectedDB || require('../../database/postgresql');

    function idDe(ref) {
        const n = Number(ref);
        if (!Number.isInteger(n) || n <= 0) throw httpError('No encontrado', 404);
        return n;
    }

    async function guardarImagen(userId, file) {
        if (!TIPOS[file.mimetype]) throw httpError('Solo se permiten imágenes JPG o PNG', 400);
        if (file.size > MAX_BYTES) throw httpError('La imagen supera 5 MB', 400);
        // express-fileupload con useTempFiles deja los bytes en un temporal.
        const datos = file.tempFilePath ? await fs.promises.readFile(file.tempFilePath) : file.data;
        if (file.tempFilePath) await fs.promises.unlink(file.tempFilePath).catch(() => {});
        const archivo = await db().onix.insertArchivo(userId, file.mimetype, datos);
        return String(archivo.id);
    }

    async function leer(ref) {
        const archivo = await db().onix.getArchivo(idDe(ref));
        if (!archivo) throw httpError('No encontrado', 404);
        return { datos: archivo.datos, mime: archivo.mime };
    }

    async function borrar(ref) {
        await db().onix.deleteArchivo(idDe(ref));
    }

    return { guardarImagen, leer, borrar };
}

module.exports = createStorage();
module.exports.createStorage = createStorage;
