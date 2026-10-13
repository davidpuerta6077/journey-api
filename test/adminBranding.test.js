const test = require('node:test');
const assert = require('node:assert');
const createAdmin = require('../api/admin/controller');

function fakeDB() {
    const archivos = new Map();
    const settings = [];
    return {
        archivos, settings,
        upsertHubArchivo: async (clave, mime, datos, by) => { archivos.set(clave, { clave, mime, datos, updated_by: by }); },
        getHubArchivo: async (clave) => archivos.get(clave) || null,
        upsertSetting: async (categoria, clave, valor, by) => { settings.push({ categoria, clave, valor, by }); return { categoria, clave, valor }; },
    };
}
const archivo = (over = {}) => ({ name: 'logo.png', mimetype: 'image/png', size: 4, data: Buffer.from('logo'), ...over });

test('saveBrandingArchivo guarda la imagen en BD y apunta el setting a /admin/branding/<clave>', async () => {
    const db = fakeDB();
    const r = await createAdmin(db).saveBrandingArchivo('logo', archivo(), 'a@x.co');
    assert.strictEqual(db.archivos.get('logo').datos.toString(), 'logo');
    assert.strictEqual(db.settings[0].categoria, 'apariencia');
    assert.strictEqual(db.settings[0].clave, 'logo_url');
    assert.match(db.settings[0].valor, /^\/admin\/branding\/logo\?v=\d+$/);
    assert.strictEqual(r.clave, 'logo_url');
});

test('favicon acepta .ico y svg; rechaza otros tipos y archivos de más de 2 MB', async () => {
    const ctrl = createAdmin(fakeDB());
    await ctrl.saveBrandingArchivo('favicon', archivo({ mimetype: 'image/x-icon' }), 'a@x.co');
    await ctrl.saveBrandingArchivo('favicon', archivo({ mimetype: 'image/svg+xml' }), 'a@x.co');
    await assert.rejects(ctrl.saveBrandingArchivo('logo', archivo({ mimetype: 'application/pdf' }), 'a@x.co'), (e) => e.status === 400);
    await assert.rejects(ctrl.saveBrandingArchivo('logo', archivo({ size: 2 * 1024 * 1024 + 1 }), 'a@x.co'), (e) => e.status === 400);
    await assert.rejects(ctrl.saveBrandingArchivo('logo', null, 'a@x.co'), (e) => e.status === 400);
});

test('solo existen las claves logo y favicon', async () => {
    const ctrl = createAdmin(fakeDB());
    await assert.rejects(ctrl.saveBrandingArchivo('otro', archivo(), 'a@x.co'), (e) => e.status === 404);
    await assert.rejects(ctrl.getBrandingArchivo('../x'), (e) => e.status === 404);
});

test('getBrandingArchivo devuelve bytes y tipo; si no hay → 404', async () => {
    const db = fakeDB();
    const ctrl = createAdmin(db);
    await assert.rejects(ctrl.getBrandingArchivo('logo'), (e) => e.status === 404);
    await ctrl.saveBrandingArchivo('logo', archivo(), 'a@x.co');
    assert.deepStrictEqual(await ctrl.getBrandingArchivo('logo'), { datos: Buffer.from('logo'), mime: 'image/png' });
});
