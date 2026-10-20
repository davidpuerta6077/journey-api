const test = require('node:test');
const assert = require('node:assert');
const { esSecreto, valorParaLog } = require('../services/settingsSecretos');
const createAdmin = require('../api/admin/controller');

test('moodle_token es secreto; otros settings no', () => {
    assert.strictEqual(esSecreto('moodle', 'moodle_token'), true);
    assert.strictEqual(esSecreto('moodle', 'moodle_url'), false);
    assert.strictEqual(esSecreto('apariencia', 'moodle_token'), false);
});

test('valorParaLog oculta los secretos y deja el resto igual', () => {
    assert.strictEqual(valorParaLog('moodle', 'moodle_token', 'abc123token'), '(oculto)');
    assert.strictEqual(valorParaLog('moodle', 'moodle_url', 'https://x'), 'https://x');
});

test('listSettings no devuelve el token: valor vacío y solo últimos 4 caracteres', async () => {
    const db = {
        getSettings: async () => [
            { categoria: 'moodle', clave: 'moodle_token', valor: 'a9667c932d294bca' },
            { categoria: 'moodle', clave: 'moodle_url', valor: 'https://m' },
        ],
    };
    const rows = await createAdmin(db).listSettings('moodle');
    assert.deepStrictEqual(rows[0], { categoria: 'moodle', clave: 'moodle_token', valor: '', secreto: { configurado: true, ultimos: '4bca' } });
    assert.strictEqual(rows[1].valor, 'https://m');
    assert.ok(!JSON.stringify(rows).includes('a9667c'));
});

test('saveSetting de un secreto vacío no lo borra ni lo pisa → 400', async () => {
    const upserts = [];
    const ctrl = createAdmin({ upsertSetting: async (...a) => { upserts.push(a); return {}; } });
    await assert.rejects(ctrl.saveSetting({ categoria: 'moodle', clave: 'moodle_token', valor: '' }, 'a@x.co'), (e) => e.status === 400);
    assert.strictEqual(upserts.length, 0);
});

test('saveSetting cifra el token de Moodle y no lo devuelve; leerSecreto acepta cifrado y texto plano', async () => {
    const { leerSecreto, cifrarSecreto } = require('../services/settingsSecretos');
    const env = { IA_SECRET_KEY: 'clave-de-prueba' };
    const anterior = process.env.IA_SECRET_KEY;
    process.env.IA_SECRET_KEY = env.IA_SECRET_KEY;
    try {
        const upserts = [];
        const ctrl = createAdmin({ upsertSetting: async (c, k, v) => { upserts.push(v); return { categoria: c, clave: k, valor: v }; } });
        const r = await ctrl.saveSetting({ categoria: 'moodle', clave: 'moodle_token', valor: ' tok-123456 ' }, 'a@x.co');
        assert.strictEqual(r.valor, '');
        assert.ok(!JSON.stringify(upserts).includes('tok-123456'));
        assert.strictEqual(upserts[0].ultimos, '3456');
        assert.strictEqual(leerSecreto(upserts[0], env), 'tok-123456');
        assert.strictEqual(leerSecreto('plano', env), 'plano');
        const rows = await createAdmin({ getSettings: async () => [{ categoria: 'moodle', clave: 'moodle_token', valor: cifrarSecreto('abcd9876', env) }] }).listSettings('moodle');
        assert.deepStrictEqual(rows[0].secreto, { configurado: true, ultimos: '9876' });
    } finally {
        if (anterior === undefined) delete process.env.IA_SECRET_KEY; else process.env.IA_SECRET_KEY = anterior;
    }
});

test('sin IA_SECRET_KEY no se guarda el token de Moodle (no queda en claro)', async () => {
    const anterior = process.env.IA_SECRET_KEY;
    delete process.env.IA_SECRET_KEY;
    try {
        const upserts = [];
        const ctrl = createAdmin({ upsertSetting: async (...a) => { upserts.push(a); return {}; } });
        await assert.rejects(ctrl.saveSetting({ categoria: 'moodle', clave: 'moodle_token', valor: 'tok' }, 'a@x.co'), (e) => e.status === 503);
        assert.strictEqual(upserts.length, 0);
    } finally {
        if (anterior !== undefined) process.env.IA_SECRET_KEY = anterior;
    }
});
