const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createStorage } = require('../services/onix/storage');

const tmpBase = () => fs.mkdtempSync(path.join(os.tmpdir(), 'onix-'));
const fakeFile = (over = {}) => ({
    name: 'foto.png', mimetype: 'image/png', size: 1000,
    mv: async (dest) => fs.writeFileSync(dest, 'img'),
    ...over,
});

test('guardarImagen guarda en <base>/<userId>/ y devuelve ruta relativa', async () => {
    const base = tmpBase();
    const s = createStorage(base);
    const rel = await s.guardarImagen(7, fakeFile());
    assert.match(rel, /^7\/\d+_[a-f0-9]{8}\.png$/);
    assert.strictEqual(fs.readFileSync(path.join(base, rel), 'utf8'), 'img');
    assert.strictEqual(s.extension(rel), 'png');
    assert.strictEqual((await s.leer(rel)).toString(), 'img');
    await s.borrar(rel);
    assert.strictEqual(fs.existsSync(path.join(base, rel)), false);
});

test('jpeg se guarda como .jpg', async () => {
    const s = createStorage(tmpBase());
    const rel = await s.guardarImagen(1, fakeFile({ name: 'a.jpeg', mimetype: 'image/jpeg' }));
    assert.match(rel, /\.jpg$/);
    assert.strictEqual(s.extension(rel), 'jpg');
});

test('tipo no permitido (gif, webp) → 400', async () => {
    const s = createStorage(tmpBase());
    await assert.rejects(s.guardarImagen(1, fakeFile({ mimetype: 'image/gif' })), (e) => e.status === 400);
    await assert.rejects(s.guardarImagen(1, fakeFile({ mimetype: 'image/webp' })), (e) => e.status === 400);
});

test('imagen de más de 5 MB → 400', async () => {
    const s = createStorage(tmpBase());
    await assert.rejects(s.guardarImagen(1, fakeFile({ size: 5 * 1024 * 1024 + 1 })), (e) => e.status === 400);
});

test('ruta que sale de la carpeta base → 404 (leer, borrar y rutaAbsoluta)', async () => {
    const s = createStorage(tmpBase());
    assert.throws(() => s.rutaAbsoluta('../../config.js'), (e) => e.status === 404);
    assert.throws(() => s.rutaAbsoluta('/etc/passwd'), (e) => e.status === 404);
    await assert.rejects(s.leer('../x.png'), (e) => e.status === 404);
    await assert.rejects(s.borrar('../x.png'), (e) => e.status === 404);
});

test('borrar un archivo inexistente no falla', async () => {
    const s = createStorage(tmpBase());
    await s.borrar('1/no-existe.png');
});
