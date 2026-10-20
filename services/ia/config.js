const { cifrar, descifrar } = require('./secreto');

// Configuración de la IA editable desde Configuración del hub (settings,
// categoría 'ia'). Lo guardado en BD manda; el .env queda como valor por
// defecto cuando no hay nada guardado.
const CATEGORIA = 'ia';
const PROVEEDORES = ['ollama', 'claude', 'gemini', 'openai'];
const OLLAMA_URL_DEFECTO = 'http://10.0.17.77:11434';
const OPENAI_URL_DEFECTO = 'https://api.openai.com/v1';

// Cada proveedor con key guarda la suya (setting cifrado) y tiene su variable de .env.
const KEYS = {
    claude: { clave: 'anthropic_key', env: 'ANTHROPIC_API_KEY' },
    gemini: { clave: 'gemini_key', env: 'GEMINI_API_KEY' },
    openai: { clave: 'openai_key', env: 'OPENAI_API_KEY' },
};
// Sin modelo por defecto: cambian seguido y en openai depende del servicio.
const MODELO_REQUERIDO = ['gemini', 'openai'];

// Instrucciones con las que la IA redacta los informes de Onix (editables en
// Configuración). El formato JSON de salida no es editable: lo agrega el módulo.
const PROMPT_INFORMES_DEFECTO = [
    'Eres un experto en gestión documental y generación de informes para contratistas universitarios de la Institución Universitaria Pascual Bravo.',
    'A partir de las notas que el contratista escribió sobre una subactividad del mes, redactas el párrafo que va en el informe de la actividad y organizas el documento de evidencia de esa subactividad.',
    'Reglas de redacción:',
    '- Redacta en tercera persona, con lenguaje técnico-profesional orientado a la educación virtual, los LMS y la innovación.',
    '- No uses siglas de sistemas o dependencias internas (por ejemplo SICAU o UEAD); usa términos descriptivos generales, como "Sistema de Gestión Académica" o "Unidad de Apoyo Digital".',
    '- Sé fiel a las notas: no inventes actividades, cifras ni resultados que no aparezcan en ellas.',
    '- Responde únicamente en español colombiano.',
].join('\n');
const PROMPT_MAX = 8000;

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
    const proveedor = hayConfig ? s.proveedor : env.IA_PROVIDER;
    // Solo se descifra la key del proveedor en uso: con Ollama no hace falta IA_SECRET_KEY.
    const key = (p) => {
        if (p !== proveedor) return env[KEYS[p].env];
        return s[KEYS[p].clave] ? descifrar(s[KEYS[p].clave], env) : env[KEYS[p].env];
    };
    return {
        IA_PROVIDER: proveedor,
        IA_MODEL: hayConfig ? (s.modelo || undefined) : env.IA_MODEL,
        OLLAMA_URL: s.ollama_url || env.OLLAMA_URL,
        OPENAI_URL: s.openai_url || env.OPENAI_URL,
        ANTHROPIC_API_KEY: key('claude'),
        GEMINI_API_KEY: key('gemini'),
        OPENAI_API_KEY: key('openai'),
    };
}

// Lo que ve la pantalla de Configuración: nunca las keys, solo si existen.
async function verConfig({ db, env = process.env }) {
    const s = await leerSettings(db);
    const keys = {};
    for (const [p, k] of Object.entries(KEYS)) {
        if (s[k.clave]) keys[p] = { configurada: true, origen: 'hub', ultimos: s[k.clave].ultimos || '' };
        else if (env[k.env]) keys[p] = { configurada: true, origen: 'servidor', ultimos: env[k.env].slice(-4) };
        else keys[p] = { configurada: false };
    }
    return {
        proveedor: s.proveedor || env.IA_PROVIDER || 'ollama',
        modelo: s.proveedor ? (s.modelo || '') : (env.IA_MODEL || ''),
        ollama_url: s.ollama_url || env.OLLAMA_URL || OLLAMA_URL_DEFECTO,
        openai_url: s.openai_url || env.OPENAI_URL || OPENAI_URL_DEFECTO,
        keys,
        prompt_informes: s.prompt_informes || PROMPT_INFORMES_DEFECTO,
        prompt_defecto: PROMPT_INFORMES_DEFECTO,
    };
}

async function leerPromptInformes(db) {
    return (await leerSettings(db)).prompt_informes || PROMPT_INFORMES_DEFECTO;
}

const urlValida = (u) => !u || /^https?:\/\/[^\s]+$/i.test(u);

// api_key y quitar_key aplican a la key del proveedor elegido.
async function guardarConfig({ db, env = process.env, body, email }) {
    const proveedor = String(body.proveedor || '').trim().toLowerCase();
    if (!PROVEEDORES.includes(proveedor)) throw httpError(`Proveedor inválido (usa ${PROVEEDORES.join(', ')})`, 400);
    const modelo = String(body.modelo || '').trim();
    if (modelo.length > 100) throw httpError('El nombre del modelo es demasiado largo', 400);
    if (!modelo && MODELO_REQUERIDO.includes(proveedor)) throw httpError('Escribe el modelo que vas a usar', 400);
    const ollamaUrl = String(body.ollama_url || '').trim();
    if (!urlValida(ollamaUrl)) throw httpError('La URL de Ollama debe empezar por http:// o https://', 400);
    const openaiUrl = String(body.openai_url || '').trim();
    if (!urlValida(openaiUrl)) throw httpError('La URL del proveedor debe empezar por http:// o https://', 400);
    const key = typeof body.api_key === 'string' ? body.api_key.trim() : '';
    const claveKey = KEYS[proveedor]?.clave;
    // Si no viene, no se toca; vacío o igual al de fábrica vuelve al de fábrica.
    const prompt = typeof body.prompt_informes === 'string' ? body.prompt_informes.trim() : null;
    if (prompt && prompt.length > PROMPT_MAX) throw httpError(`Las instrucciones superan ${PROMPT_MAX} caracteres`, 400);

    // Cifrar antes de escribir nada: si falta IA_SECRET_KEY no queda una config a medias.
    const keyCifrada = key && claveKey ? { ...cifrar(key, env), ultimos: key.slice(-4) } : null;

    await db.upsertSetting(CATEGORIA, 'proveedor', proveedor, email);
    await db.upsertSetting(CATEGORIA, 'modelo', modelo, email);
    await db.upsertSetting(CATEGORIA, 'ollama_url', ollamaUrl, email);
    await db.upsertSetting(CATEGORIA, 'openai_url', openaiUrl, email);
    if (keyCifrada) await db.upsertSetting(CATEGORIA, claveKey, keyCifrada, email);
    const keyQuitada = !keyCifrada && !!claveKey && body.quitar_key === true;
    if (keyQuitada) await db.deleteSetting(CATEGORIA, claveKey);
    if (prompt !== null) {
        if (!prompt || prompt === PROMPT_INFORMES_DEFECTO) await db.deleteSetting(CATEGORIA, 'prompt_informes');
        else await db.upsertSetting(CATEGORIA, 'prompt_informes', prompt, email);
    }

    return { proveedor, keyCambiada: !!keyCifrada, keyQuitada };
}

module.exports = { CATEGORIA, leerEnvEfectivo, verConfig, guardarConfig, leerPromptInformes };
