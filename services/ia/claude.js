const sdk = require('@anthropic-ai/sdk');
const { iaError } = require('./errors');

const Anthropic = sdk.default || sdk;

// Proveedor Claude (API de Anthropic, key institucional). Usa el respaldo del
// lado del servidor (`fallbacks: 'default'`): si el modelo rechaza la solicitud,
// Anthropic la reintenta con otro modelo dentro de la misma llamada.
module.exports = function createClaude({ client, apiKey, model }) {
    const c = client || new Anthropic({ apiKey });

    return {
        async generar({ system, prompt }) {
            let res;
            try {
                res = await c.beta.messages.create({
                    model,
                    max_tokens: 16000,
                    system,
                    messages: [{ role: 'user', content: prompt }],
                    betas: ['server-side-fallback-2026-07-01'],
                    fallbacks: 'default',
                });
            } catch (e) {
                if (e instanceof Anthropic.AuthenticationError) throw iaError('La API key de Claude no es válida');
                if (e instanceof Anthropic.RateLimitError) throw iaError('Claude está saturado, intenta de nuevo en unos minutos');
                if (e instanceof Anthropic.APIError) throw iaError(`La IA no respondió (error ${e.status ?? 'desconocido'})`);
                throw iaError('La IA no respondió');
            }

            if (res.stop_reason === 'refusal') {
                throw iaError('La IA no generó el texto para estos registros', 422);
            }
            const texto = res.content
                .filter((b) => b.type === 'text')
                .map((b) => b.text)
                .join('')
                .trim();
            if (!texto) throw iaError('La IA devolvió una respuesta vacía');
            return { texto, proveedor: 'claude', modelo: res.model || model };
        },
    };
};
