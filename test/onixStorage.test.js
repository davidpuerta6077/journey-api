const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createStorage } = require('../services/onix/storage');

function fakeDB() {
    const archivos = new Map();
    let seq = 0;
    return {
        archivos,
        onix: {
            insertArchivo: async (userId, mime, datos) => { const id = ++seq; archivos.set(id, { id, user_id: userId, mime, datos }); return { id }; },
            getArchivo: async (id) => archivos.get(id) || null,
            deleteArchivo: async (id) => { archivos.delete(id); },
        },
    };
}

const fakeFile = (over = {}) => ({ name: 'foto.png', mimetype: 'image/png', size: 3, data: Buffer.from('img'), ...over });

test('guardarImagen guarda los bytes en la BD y devuelve el id como referencia', async () => {
    const db = fakeDB();
    const s = createStorage(db);
    const ref = await s.guardarImagen(7, fakeFile());
    assert.strictEqual(ref, '1');
    assert.strictEqual(db.archivos.get(1).user_id, 7);
    assert.deepStrictEqual(await s.leer(ref), { datos: Buffer.from('img'), mime: 'image/png' });
    await s.borrar(ref);
    assert.strictEqual(db.archivos.size, 0);
});

test('con archivos temporales (useTempFiles) lee el temporal y lo borra', async () => {
    const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'onix-')), 'up');
    fs.writeFileSync(tmp, 'jpgdata');
    const db = fakeDB();
    const ref = await createStorage(db).guardarImagen(1, fakeFile({ mimetype: 'image/jpeg', data: Buffer.alloc(0), tempFilePath: tmp }));
    assert.strictEqual(db.archivos.get(Number(ref)).datos.toString(), 'jpgdata');
    assert.strictEqual(fs.existsSync(tmp), false);
});

test('tipo no permitido (gif, webp) → 400', async () => {
    const s = createStorage(fakeDB());
    await assert.rejects(s.guardarImagen(1, fakeFile({ mimetype: 'image/gif' })), (e) => e.status === 400);
    await assert.rejects(s.guardarImagen(1, fakeFile({ mimetype: 'image/webp' })), (e) => e.status === 400);
});

test('imagen de más de 5 MB → 400', async () => {
    const s = createStorage(fakeDB());
    await assert.rejects(s.guardarImagen(1, fakeFile({ size: 5 * 1024 * 1024 + 1 })), (e) => e.status === 400);
});

test('referencia inválida o inexistente → 404', async () => {
    const s = createStorage(fakeDB());
    await assert.rejects(s.leer('../../config.js'), (e) => e.status === 404);
    await assert.rejects(s.leer('99'), (e) => e.status === 404);
    await assert.rejects(s.borrar('abc'), (e) => e.status === 404);
});
