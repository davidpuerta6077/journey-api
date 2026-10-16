const { cifrar, descifrar } = require('../ia/secreto');

// Credencial de Google (OAuth) editable desde Configuración > Google (settings,
// categoría 'google'). Lo guardado en BD manda; el .env queda de respaldo.
// El secreto se guarda cifrado con IA_SECRET_KEY, igual que las API keys de IA.
const CATEGORIA = 'google';

function httpError(message, status) {
    const err = new Error(message);
    err.status = status;
    return err;
}

async function leerSettings(db) {
    const rows = await db.getSettings(CATEGORIA);
    return Object.fromEntries(rows.map((r) => [r.clave, r.valor]));
}

// Variables con las que se construye el servicio de Google en cada uso.
async function leerEnvEfectivo({ db, env = process.env }) {
    const s = await leerSettings(db);
    return {
        GOOGLE_CLIENT_ID: s.client_id || env.GOOGLE_CLIENT_ID,
        GOOGLE_CLIENT_SECRET: s.client_secret ? descifrar(s.client_secret, env) : env.GOOGLE_CLIENT_SECRET,
        GOOGLE_REDIRECT_URI: s.redirect_uri || env.GOOGLE_REDIRECT_URI,
        FRONT_URL: s.front_url || env.FRONT_URL,
    };
}

// Lo que ve la pantalla: nunca el secreto, solo si existe y sus últimos 4.
async function verConfig({ db, env = process.env }) {
    const s = await leerSettings(db);
    let secreto = { configurado: false };
    if (s.client_secret) secreto = { configurado: true, origen: 'hub', ultimos: s.client_secret.ultimos || '' };
    else if (env.GOOGLE_CLIENT_SECRET) secreto = { configurado: true, origen: 'servidor', ultimos: env.GOOGLE_CLIENT_SECRET.slice(-4) };
    return {
        client_id: s.client_id || env.GOOGLE_CLIENT_ID || '',
        redirect_uri: s.redirect_uri || env.GOOGLE_REDIRECT_URI || '',
        front_url: s.front_url || env.FRONT_URL || '',
        secreto,
    };
}

const URL_VALIDA = /^https?:\/\/[^\s]+$/i;

async function guardarConfig({ db, env = process.env, body, email }) {
    const clientId = String(body.client_id || '').trim();
    if (clientId && !/\.apps\.googleusercontent\.com$/.test(clientId)) {
        throw httpError('El ID de cliente debe terminar en .apps.googleusercontent.com', 400);
    }
    const redirectUri = String(body.redirect_uri || '').trim();
    if (redirectUri && !URL_VALIDA.test(redirectUri)) throw httpError('La URL de retorno debe empezar por http:// o https://', 400);
    if (redirectUri && !redirectUri.endsWith('/onix/google/callback')) throw httpError('La URL de retorno debe terminar en /onix/google/callback', 400);
    const frontUrl = String(body.front_url || '').trim();
    if (frontUrl && !URL_VALIDA.test(frontUrl)) throw httpError('La URL de Bravo Hub debe empezar por http:// o https://', 400);
    const secreto = typeof body.client_secret === 'string' ? body.client_secret.trim() : '';

    // Cifrar antes de escribir nada: si falta IA_SECRET_KEY no queda una config a medias.
    const cifrado = secreto ? { ...cifrar(secreto, env), ultimos: secreto.slice(-4) } : null;

    await db.upsertSetting(CATEGORIA, 'client_id', clientId, email);
    await db.upsertSetting(CATEGORIA, 'redirect_uri', redirectUri, email);
    await db.upsertSetting(CATEGORIA, 'front_url', frontUrl, email);
    if (cifrado) await db.upsertSetting(CATEGORIA, 'client_secret', cifrado, email);
    const secretoQuitado = !cifrado && body.quitar_secreto === true;
    if (secretoQuitado) await db.deleteSetting(CATEGORIA, 'client_secret');

    return { secretoCambiado: !!cifrado, secretoQuitado };
}

module.exports = { CATEGORIA, leerEnvEfectivo, verConfig, guardarConfig };
