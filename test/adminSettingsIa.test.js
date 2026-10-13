const test = require('node:test');
const assert = require('node:assert');
const createAdmin = require('../api/admin/controller');

function fakeDB() {
    const rows = [
        { categoria: 'apariencia', clave: 'logo_url', valor: '/x.png' },
        { categoria: 'ia', clave: 'proveedor', valor: 'claude' },
        { categoria: 'ia', clave: 'anthropic_key', valor: { iv: 'a', tag: 'b', data: 'c', ultimos: '1234' } },
    ];
    return {
        upserts: [],
        getSettings: async (cat) => rows.filter((r) => !cat || r.categoria === cat),
        upsertSetting: async function (...args) { this.upserts.push(args); return {}; },
        deleteSetting: async () => [],
    };
}

test('la ruta genérica de settings rechaza la categoría ia (guardar y borrar)', async () => {
    const db = fakeDB();
    const ctrl = createAdmin(db);
    await assert.rejects(ctrl.saveSetting({ categoria: 'ia', clave: 'anthropic_key', valor: 'sk-ant-x' }, 'a@x.co'), (e) => e.status === 400);
    await assert.rejects(ctrl.removeSetting('ia', 'proveedor'), (e) => e.status === 400);
    assert.strictEqual(db.upserts.length, 0);
});

test('listSettings nunca devuelve la key cifrada, con o sin categoría', async () => {
    const ctrl = createAdmin(fakeDB());
    for (const cat of [undefined, 'ia']) {
        const rows = await ctrl.listSettings(cat);
        assert.ok(!rows.some((r) => r.clave === 'anthropic_key'), `filtró key con categoria=${cat}`);
    }
    assert.strictEqual((await ctrl.listSettings()).length, 2);
});

test('getIAConfig devuelve la vista sin key', async () => {
    const ctrl = createAdmin(fakeDB());
    const v = await ctrl.getIAConfig();
    assert.strictEqual(v.proveedor, 'claude');
    assert.deepStrictEqual(v.key, { configurada: true, origen: 'hub', ultimos: '1234' });
    assert.ok(!JSON.stringify(v).includes('"data"'));
});
