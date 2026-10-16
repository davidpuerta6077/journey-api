const test = require('node:test');
const assert = require('node:assert');
const { createIA } = require('../services/ia');

const respuestaClaude = (over = {}) => ({
    model: 'claude-opus-5-5',
    stop_reason: 'end_turn',
    content: [{ type: 'thinking', thinking: '' }, { type: 'text', text: 'Párrafo ' }, { type: 'text', text: 'formal.' }],
    ...over,
});

const fakeClaude = (reply) => {
    const calls = [];
    return {
        calls,
        beta: { messages: { create: async (params) => { calls.push(params); if (reply instanceof Error) throw reply; return reply; } } },
    };
};

test('sin IA_PROVIDER usa Ollama con URL y modelo por defecto', async () => {
    const calls = [];
    const fetchFn = async (url, opts) => { calls.push({ url, body: JSON.parse(opts.body) }); return { ok: true, json: async () => ({ response: ' Texto local. ' }) }; };
    const r = await createIA({ env: {}, fetchFn }).generarTexto({ system: 'S', prompt: 'P' });
    assert.deepStrictEqual(r, { texto: 'Texto local.', proveedor: 'ollama', modelo: 'qwen2.5:7b' });
    assert.strictEqual(calls[0].url, 'http://10.0.17.77:11434/api/generate');
    assert.deepStrictEqual(calls[0].body, { model: 'qwen2.5:7b', system: 'S', prompt: 'P', stream: false });
});

test('IA_PROVIDER=claude llama al SDK con fallbacks y concatena solo bloques de texto', async () => {
    const client = fakeClaude(respuestaClaude());
    const r = await createIA({ env: { IA_PROVIDER: 'claude', ANTHROPIC_API_KEY: 'k' }, claudeClient: client }).generarTexto({ system: 'S', prompt: 'P' });
    assert.deepStrictEqual(r, { texto: 'Párrafo formal.', proveedor: 'claude', modelo: 'claude-opus-5-5' });
    const p = client.calls[0];
    assert.strictEqual(p.model, 'claude-opus-5-5');
    assert.strictEqual(p.system, 'S');
    assert.deepStrictEqual(p.messages, [{ role: 'user', content: 'P' }]);
    assert.deepStrictEqual(p.betas, ['server-side-fallback-2026-07-01']);
    assert.strictEqual(p.fallbacks, 'default');
});

test('IA_MODEL sobreescribe el modelo de Claude y se reporta el modelo que respondió', async () => {
    const client = fakeClaude(respuestaClaude({ model: 'claude-sonnet-5-5' }));
    const r = await createIA({ env: { IA_PROVIDER: 'claude', ANTHROPIC_API_KEY: 'k', IA_MODEL: 'claude-sonnet-5-5' }, claudeClient: client }).generarTexto({ system: 'S', prompt: 'P' });
    assert.strictEqual(client.calls[0].model, 'claude-sonnet-5-5');
    assert.strictEqual(r.modelo, 'claude-sonnet-5-5');
});

test('claude sin ANTHROPIC_API_KEY → 503 "no está configurada"', async () => {
    await assert.rejects(createIA({ env: { IA_PROVIDER: 'claude' } }).generarTexto({ system: 'S', prompt: 'P' }),
        (e) => e.status === 503 && e.message.includes('no está configurada'));
});

test('proveedor desconocido → 503', async () => {
    await assert.rejects(createIA({ env: { IA_PROVIDER: 'gpt' } }).generarTexto({ system: 'S', prompt: 'P' }),
        (e) => e.status === 503 && e.message.includes('"gpt"'));
});

test('rechazo de Claude (refusal) → 422', async () => {
    const client = fakeClaude(respuestaClaude({ stop_reason: 'refusal', content: [] }));
    await assert.rejects(createIA({ env: { IA_PROVIDER: 'claude', ANTHROPIC_API_KEY: 'k' }, claudeClient: client }).generarTexto({ system: 'S', prompt: 'P' }),
        (e) => e.status === 422);
});

test('Claude caído (error de red) → 503', async () => {
    const client = fakeClaude(new Error('ECONNRESET'));
    await assert.rejects(createIA({ env: { IA_PROVIDER: 'claude', ANTHROPIC_API_KEY: 'k' }, claudeClient: client }).generarTexto({ system: 'S', prompt: 'P' }),
        (e) => e.status === 503 && e.message.includes('no respondió'));
});

test('Ollama caído o con error HTTP → 503; respuesta vacía → 503', async () => {
    const caido = async () => { throw new Error('ECONNREFUSED'); };
    await assert.rejects(createIA({ env: {}, fetchFn: caido }).generarTexto({ system: 'S', prompt: 'P' }), (e) => e.status === 503);
    const http500 = async () => ({ ok: false, status: 500, json: async () => ({}) });
    await assert.rejects(createIA({ env: {}, fetchFn: http500 }).generarTexto({ system: 'S', prompt: 'P' }), (e) => e.status === 503 && e.message.includes('500'));
    const vacia = async () => ({ ok: true, json: async () => ({ response: '  ' }) });
    await assert.rejects(createIA({ env: {}, fetchFn: vacia }).generarTexto({ system: 'S', prompt: 'P' }), (e) => e.status === 503 && e.message.includes('vacía'));
});

test('IA_PROVIDER=gemini llama a la API de Google con la key en header y junta las partes de texto', async () => {
    const calls = [];
    const fetchFn = async (url, opts) => {
        calls.push({ url, headers: opts.headers, body: JSON.parse(opts.body) });
        return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Hola ' }, { text: 'Gemini.' }] } }] }) };
    };
    const r = await createIA({ env: { IA_PROVIDER: 'gemini', GEMINI_API_KEY: 'g-key', IA_MODEL: 'gemini-x' }, fetchFn }).generarTexto({ system: 'S', prompt: 'P' });
    assert.deepStrictEqual(r, { texto: 'Hola Gemini.', proveedor: 'gemini', modelo: 'gemini-x' });
    assert.strictEqual(calls[0].url, 'https://generativelanguage.googleapis.com/v1beta/models/gemini-x:generateContent');
    assert.strictEqual(calls[0].headers['x-goog-api-key'], 'g-key');
    assert.deepStrictEqual(calls[0].body.systemInstruction, { parts: [{ text: 'S' }] });
    assert.deepStrictEqual(calls[0].body.contents, [{ role: 'user', parts: [{ text: 'P' }] }]);
});

test('IA_PROVIDER=openai usa /chat/completions de la URL configurada con Bearer', async () => {
    const calls = [];
    const fetchFn = async (url, opts) => {
        calls.push({ url, headers: opts.headers, body: JSON.parse(opts.body) });
        return { ok: true, json: async () => ({ model: 'llama-3', choices: [{ message: { content: ' Hola. ' } }] }) };
    };
    const env = { IA_PROVIDER: 'openai', OPENAI_API_KEY: 'o-key', OPENAI_URL: 'https://api.groq.com/openai/v1/', IA_MODEL: 'llama-3' };
    const r = await createIA({ env, fetchFn }).generarTexto({ system: 'S', prompt: 'P' });
    assert.deepStrictEqual(r, { texto: 'Hola.', proveedor: 'openai', modelo: 'llama-3' });
    assert.strictEqual(calls[0].url, 'https://api.groq.com/openai/v1/chat/completions');
    assert.strictEqual(calls[0].headers.Authorization, 'Bearer o-key');
    assert.deepStrictEqual(calls[0].body.messages, [{ role: 'system', content: 'S' }, { role: 'user', content: 'P' }]);
});

test('gemini/openai sin key o sin modelo → 503; error HTTP 401 → 503 key inválida', async () => {
    const fetchFn = async () => ({ ok: false, status: 401, json: async () => ({}) });
    const gen = (env) => createIA({ env, fetchFn }).generarTexto({ system: 'S', prompt: 'P' });
    await assert.rejects(gen({ IA_PROVIDER: 'gemini', IA_MODEL: 'm' }), (e) => e.status === 503 && /API key/.test(e.message));
    await assert.rejects(gen({ IA_PROVIDER: 'openai', OPENAI_API_KEY: 'k' }), (e) => e.status === 503 && /modelo/.test(e.message));
    await assert.rejects(gen({ IA_PROVIDER: 'gemini', GEMINI_API_KEY: 'k', IA_MODEL: 'm' }), (e) => e.status === 503 && /no es válida/.test(e.message));
    await assert.rejects(gen({ IA_PROVIDER: 'openai', OPENAI_API_KEY: 'k', IA_MODEL: 'm' }), (e) => e.status === 503 && /no es válida/.test(e.message));
});
