const test = require('node:test');
const assert = require('node:assert');
const { cifrar, descifrar } = require('../services/ia/secreto');
const { leerEnvEfectivo, verConfig, guardarConfig } = require('../services/ia/config');
const { createIA } = require('../services/ia');

const ENV = { IA_SECRET_KEY: 'clave-maestra-de-prueba' };

function fakeDB(rows = []) {
    const st = new Map(rows.map((r) => [r.clave, r.valor]));
    return {
        st,
        getSettings: async (cat) => (cat === 'ia' ? [...st].map(([clave, valor]) => ({ categoria: 'ia', clave, valor })) : []),
        upsertSetting: async (cat, clave, valor) => { assert.strictEqual(cat, 'ia'); st.set(clave, valor); return { clave }; },
        deleteSetting: async (cat, clave) => { st.delete(clave); },
    };
}

test('cifrar/descifrar ida y vuelta; el cifrado no contiene la key', () => {
    const c = cifrar('sk-ant-123456', ENV);
    assert.ok(!JSON.stringify(c).includes('sk-ant'));
    assert.strictEqual(descifrar(c, ENV), 'sk-ant-123456');
});

test('descifrar con otra clave maestra falla con 503', () => {
    const c = cifrar('sk-ant-123456', ENV);
    assert.throws(() => descifrar(c, { IA_SECRET_KEY: 'otra' }), (e) => e.status === 503);
});

test('sin IA_SECRET_KEY no se puede cifrar → 503', () => {
    assert.throws(() => cifrar('x', {}), (e) => e.status === 503 && e.message.includes('IA_SECRET_KEY'));
});

test('sin nada en BD se usa el .env', async () => {
    const env = { IA_PROVIDER: 'claude', ANTHROPIC_API_KEY: 'env-key', IA_MODEL: 'm', OLLAMA_URL: 'http://o' };
    assert.deepStrictEqual(await leerEnvEfectivo({ db: fakeDB(), env }),
        { IA_PROVIDER: 'claude', IA_MODEL: 'm', OLLAMA_URL: 'http://o', OPENAI_URL: undefined, ANTHROPIC_API_KEY: 'env-key', GEMINI_API_KEY: undefined, OPENAI_API_KEY: undefined });
});

test('la configuración de BD manda sobre el .env (proveedor, modelo vacío, url y key cifrada)', async () => {
    const env = { ...ENV, IA_PROVIDER: 'ollama', IA_MODEL: 'qwen2.5:7b', ANTHROPIC_API_KEY: 'env-key' };
    const db = fakeDB([
        { clave: 'proveedor', valor: 'claude' },
        { clave: 'modelo', valor: '' },
        { clave: 'ollama_url', valor: 'http://10.0.0.1:11434' },
        { clave: 'anthropic_key', valor: { ...cifrar('hub-key', env), ultimos: '-key' } },
    ]);
    assert.deepStrictEqual(await leerEnvEfectivo({ db, env }),
        { IA_PROVIDER: 'claude', IA_MODEL: undefined, OLLAMA_URL: 'http://10.0.0.1:11434', OPENAI_URL: undefined, ANTHROPIC_API_KEY: 'hub-key', GEMINI_API_KEY: undefined, OPENAI_API_KEY: undefined });
});

test('guardarConfig valida proveedor y URL', async () => {
    const db = fakeDB();
    await assert.rejects(guardarConfig({ db, env: ENV, body: { proveedor: 'gpt' } }), (e) => e.status === 400);
    await assert.rejects(guardarConfig({ db, env: ENV, body: { proveedor: 'ollama', ollama_url: 'ftp://x' } }), (e) => e.status === 400);
});

test('guardarConfig cifra la key, guarda últimos 4 y verConfig nunca la devuelve', async () => {
    const db = fakeDB();
    const r = await guardarConfig({ db, env: ENV, body: { proveedor: 'claude', modelo: ' claude-opus-5-5 ', ollama_url: '', api_key: ' sk-ant-abcd1234 ' } });
    assert.deepStrictEqual(r, { proveedor: 'claude', keyCambiada: true, keyQuitada: false });
    const guardada = db.st.get('anthropic_key');
    assert.ok(!JSON.stringify(guardada).includes('sk-ant'));
    assert.strictEqual(guardada.ultimos, '1234');
    assert.strictEqual(db.st.get('modelo'), 'claude-opus-5-5');
    const vista = await verConfig({ db, env: ENV });
    assert.ok(!JSON.stringify(vista).includes('sk-ant'));
    assert.deepStrictEqual(vista.keys.claude, { configurada: true, origen: 'hub', ultimos: '1234' });
    assert.deepStrictEqual(vista.keys.gemini, { configurada: false });
    assert.strictEqual((await leerEnvEfectivo({ db, env: ENV })).ANTHROPIC_API_KEY, 'sk-ant-abcd1234');
});

test('key vacía no cambia la guardada; quitar_key la borra', async () => {
    const db = fakeDB();
    await guardarConfig({ db, env: ENV, body: { proveedor: 'claude', api_key: 'sk-ant-1111' } });
    const r1 = await guardarConfig({ db, env: ENV, body: { proveedor: 'claude', api_key: '' } });
    assert.strictEqual(r1.keyCambiada, false);
    assert.ok(db.st.has('anthropic_key'));
    const r2 = await guardarConfig({ db, env: ENV, body: { proveedor: 'claude', quitar_key: true } });
    assert.strictEqual(r2.keyQuitada, true);
    assert.ok(!db.st.has('anthropic_key'));
});

test('verConfig sin key en BD informa la del servidor (.env) sin exponerla', async () => {
    const vista = await verConfig({ db: fakeDB(), env: { ANTHROPIC_API_KEY: 'sk-ant-env-9876' } });
    assert.deepStrictEqual(vista.keys.claude, { configurada: true, origen: 'servidor', ultimos: '9876' });
    assert.strictEqual(vista.proveedor, 'ollama');
    assert.strictEqual(vista.ollama_url, 'http://10.0.17.77:11434');
});

test('createIA con getEnv lee la configuración en cada generación', async () => {
    let proveedor = 'ollama';
    const fetchFn = async () => ({ ok: true, json: async () => ({ response: 'Hola' }) });
    const claudeClient = { beta: { messages: { create: async () => ({ model: 'claude-opus-5-5', stop_reason: 'end_turn', content: [{ type: 'text', text: 'Hola' }] }) } } };
    const ia = createIA({ getEnv: async () => ({ IA_PROVIDER: proveedor, ANTHROPIC_API_KEY: 'k' }), fetchFn, claudeClient });
    assert.strictEqual((await ia.generarTexto({ system: 'S', prompt: 'P' })).proveedor, 'ollama');
    proveedor = 'claude';
    assert.strictEqual((await ia.generarTexto({ system: 'S', prompt: 'P' })).proveedor, 'claude');
});

test('guardarConfig: la key se guarda en la del proveedor elegido; gemini/openai piden modelo; openai valida URL', async () => {
    const db = fakeDB();
    await guardarConfig({ db, env: ENV, body: { proveedor: 'gemini', modelo: 'gemini-x', api_key: 'AIza-5678' } });
    assert.strictEqual(db.st.get('gemini_key').ultimos, '5678');
    assert.ok(!db.st.has('anthropic_key'));
    assert.strictEqual((await leerEnvEfectivo({ db, env: ENV })).GEMINI_API_KEY, 'AIza-5678');
    await assert.rejects(guardarConfig({ db, env: ENV, body: { proveedor: 'openai', modelo: '' } }), (e) => e.status === 400);
    await assert.rejects(guardarConfig({ db, env: ENV, body: { proveedor: 'openai', modelo: 'm', openai_url: 'x' } }), (e) => e.status === 400);
    await guardarConfig({ db, env: ENV, body: { proveedor: 'openai', modelo: 'm', openai_url: 'https://api.groq.com/openai/v1', api_key: 'gsk-0000' } });
    const vista = await verConfig({ db, env: ENV });
    assert.strictEqual(vista.openai_url, 'https://api.groq.com/openai/v1');
    assert.deepStrictEqual(vista.keys.openai, { configurada: true, origen: 'hub', ultimos: '0000' });
    assert.deepStrictEqual(vista.keys.gemini, { configurada: true, origen: 'hub', ultimos: '5678' });
});
