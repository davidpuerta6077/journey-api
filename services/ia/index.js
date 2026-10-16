const createClaude = require('./claude');
const createOllama = require('./ollama');
const createGemini = require('./gemini');
const createOpenAI = require('./openai');
const { iaError } = require('./errors');

// Servicio de IA genérico de Bravo Hub. El proveedor sale de IA_PROVIDER
// (claude | ollama | gemini | openai, por defecto ollama; openai = cualquier API
// compatible con OpenAI según OPENAI_URL). Con `getEnv` las variables se leen en
// cada generación (Configuración > Inteligencia artificial, sin reiniciar);
// sin él se usa `env` fijo. No hay fallback automático entre proveedores.
function construir(env, { claudeClient, fetchFn }) {
    const proveedor = (env.IA_PROVIDER || 'ollama').trim().toLowerCase();
    if (proveedor === 'claude') {
        if (!env.ANTHROPIC_API_KEY && !claudeClient) {
            throw iaError('La IA no está configurada: falta la API key de Claude (Configuración > Inteligencia artificial)');
        }
        return createClaude({ client: claudeClient, apiKey: env.ANTHROPIC_API_KEY, model: env.IA_MODEL || 'claude-opus-5-5' });
    }
    if (proveedor === 'ollama') {
        return createOllama({ fetchFn, url: env.OLLAMA_URL || 'http://10.0.17.77:11434', model: env.IA_MODEL || 'qwen2.5:7b' });
    }
    if (proveedor === 'gemini' || proveedor === 'openai') {
        const nombre = proveedor === 'gemini' ? 'Gemini' : 'la IA compatible con OpenAI';
        const apiKey = proveedor === 'gemini' ? env.GEMINI_API_KEY : env.OPENAI_API_KEY;
        if (!apiKey) throw iaError(`La IA no está configurada: falta la API key de ${nombre} (Configuración > Inteligencia artificial)`);
        if (!env.IA_MODEL) throw iaError(`La IA no está configurada: falta el modelo de ${nombre} (Configuración > Inteligencia artificial)`);
        if (proveedor === 'gemini') return createGemini({ fetchFn, apiKey, model: env.IA_MODEL });
        return createOpenAI({ fetchFn, apiKey, model: env.IA_MODEL, url: env.OPENAI_URL || 'https://api.openai.com/v1' });
    }
    throw iaError(`La IA no está configurada: proveedor "${proveedor}" no válido`);
}

function createIA({ env = process.env, getEnv, claudeClient, fetchFn } = {}) {
    return {
        async generarTexto({ system, prompt }) {
            const e = getEnv ? await getEnv() : env;
            return construir(e, { claudeClient, fetchFn }).generar({ system, prompt });
        },
    };
}

// IA de Bravo Hub: configuración guardada en BD (settings 'ia') sobre el .env.
function createIAConfigurada(db = require('../../database/postgresql'), env = process.env) {
    const { leerEnvEfectivo } = require('./config');
    return createIA({ getEnv: () => leerEnvEfectivo({ db, env }) });
}

module.exports = { createIA, createIAConfigurada };
