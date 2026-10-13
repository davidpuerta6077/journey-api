const createClaude = require('./claude');
const createOllama = require('./ollama');
const { iaError } = require('./errors');

// Servicio de IA genérico de Bravo Hub. El proveedor se elige con IA_PROVIDER
// (claude | ollama, por defecto ollama); cambiarlo es editar .env y reiniciar.
// No hay fallback automático entre proveedores: si el elegido falla, se informa.
function createIA({ env = process.env, claudeClient, fetchFn } = {}) {
    const proveedor = (env.IA_PROVIDER || 'ollama').trim().toLowerCase();
    let impl = null;

    function getImpl() {
        if (impl) return impl;
        if (proveedor === 'claude') {
            if (!env.ANTHROPIC_API_KEY && !claudeClient) {
                throw iaError('La IA no está configurada: falta ANTHROPIC_API_KEY');
            }
            impl = createClaude({ client: claudeClient, apiKey: env.ANTHROPIC_API_KEY, model: env.IA_MODEL || 'claude-opus-5-5' });
        } else if (proveedor === 'ollama') {
            impl = createOllama({ fetchFn, url: env.OLLAMA_URL || 'http://10.0.17.77:11434', model: env.IA_MODEL || 'qwen2.5:7b' });
        } else {
            throw iaError(`La IA no está configurada: proveedor "${proveedor}" no válido (usa claude u ollama)`);
        }
        return impl;
    }

    return {
        async generarTexto({ system, prompt }) {
            return getImpl().generar({ system, prompt });
        },
    };
}

module.exports = { createIA };
