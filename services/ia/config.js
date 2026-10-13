const { cifrar, descifrar } = require('./secreto');

// Configuración de la IA editable desde Configuración del hub (settings,
// categoría 'ia'). Lo guardado en BD manda; el .env queda como valor por
// defecto cuando no hay nada guardado.
const CATEGORIA = 'ia';
const PROVEEDORES = ['claude', 'ollama'];
const OLLAMA_URL_DEFECTO = 'http://10.0.17.77:11434';

function httpError(message, status) {
    const err = new Error(message);
    err.status = status;
    return err;
}

async function leerSettings(db) {
    const rows = await db.getSettings(CATEGORIA);
    return Object.fromEntries(rows.map((r) => [r.clave, r.valor]));
}

// Variables con las que createIA construye el proveedor en cada generación.
async function leerEnvEfectivo({ db, env = process.env }) {
    const s = await leerSettings(db);
    const hayConfig = typeof s.proveedor === 'string' && s.proveedor !== '';
    return {
        IA_PROVIDER: hayConfig ? s.proveedor : env.IA_PROVIDER,
        IA_MODEL: hayConfig ? (s.modelo || undefined) : env.IA_MODEL,
        OLLAMA_URL: s.ollama_url || env.OLLAMA_URL,
        ANTHROPIC_API_KEY: s.anthropic_key ? descifrar(s.anthropic_key, env) : env.ANTHROPIC_API_KEY,
    };
}

// Lo que ve la pantalla de Configuración: nunca la key, solo si existe.
async function verConfig({ db, env = process.env }) {
    const s = await leerSettings(db);
    let key = { configurada: false };
    if (s.anthropic_key) key = { configurada: true, origen: 'hub', ultimos: s.anthropic_key.ultimos || '' };
    else if (env.ANTHROPIC_API_KEY) key = { configurada: true, origen: 'servidor', ultimos: env.ANTHROPIC_API_KEY.slice(-4) };
    return {
        proveedor: s.proveedor || env.IA_PROVIDER || 'ollama',
        modelo: s.proveedor ? (s.modelo || '') : (env.IA_MODEL || ''),
        ollama_url: s.ollama_url || env.OLLAMA_URL || OLLAMA_URL_DEFECTO,
        key,
    };
}

async function guardarConfig({ db, env = process.env, body, email }) {
    const proveedor = String(body.proveedor || '').trim().toLowerCase();
    if (!PROVEEDORES.includes(proveedor)) throw httpError('Proveedor inválido (usa claude u ollama)', 400);
    const modelo = String(body.modelo || '').trim();
    if (modelo.length > 100) throw httpError('El nombre del modelo es demasiado largo', 400);
    const ollamaUrl = String(body.ollama_url || '').trim();
    if (ollamaUrl && !/^https?:\/\/[^\s]+$/i.test(ollamaUrl)) throw httpError('La URL de Ollama debe empezar por http:// o https://', 400);
    const key = typeof body.anthropic_key === 'string' ? body.anthropic_key.trim() : '';

    // Cifrar antes de escribir nada: si falta IA_SECRET_KEY no queda una config a medias.
    const keyCifrada = key ? { ...cifrar(key, env), ultimos: key.slice(-4) } : null;

    await db.upsertSetting(CATEGORIA, 'proveedor', proveedor, email);
    await db.upsertSetting(CATEGORIA, 'modelo', modelo, email);
    await db.upsertSetting(CATEGORIA, 'ollama_url', ollamaUrl, email);
    if (keyCifrada) await db.upsertSetting(CATEGORIA, 'anthropic_key', keyCifrada, email);
    const keyQuitada = !keyCifrada && body.quitar_key === true;
    if (keyQuitada) await db.deleteSetting(CATEGORIA, 'anthropic_key');

    return { proveedor, keyCambiada: !!keyCifrada, keyQuitada };
}

module.exports = { CATEGORIA, leerEnvEfectivo, verConfig, guardarConfig };
