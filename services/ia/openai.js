const { iaError } = require('./errors');

// Proveedor compatible con la API de OpenAI (/chat/completions): OpenAI, Groq,
// DeepSeek, Mistral, OpenRouter, LM Studio, etc. Solo cambia la URL base.
module.exports = function createOpenAI({ fetchFn = fetch, url, apiKey, model }) {
    return {
        async generar({ system, prompt }) {
            let res;
            try {
                res = await fetchFn(`${url.replace(/\/+$/, '')}/chat/completions`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
                    body: JSON.stringify({
                        model,
                        messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }],
                    }),
                    signal: AbortSignal.timeout(120000),
                });
            } catch {
                throw iaError('La IA no respondió (revisa la URL)');
            }
            if (res.status === 401 || res.status === 403) throw iaError('La API key no es válida');
            if (res.status === 404) throw iaError('El modelo o la URL no existen en ese proveedor');
            if (res.status === 429) throw iaError('El proveedor está saturado o se agotó la cuota, intenta de nuevo en unos minutos');
            if (!res.ok) throw iaError(`La IA respondió con error ${res.status}`);
            const data = await res.json().catch(() => null);
            const texto = (data?.choices?.[0]?.message?.content || '').trim();
            if (!texto) throw iaError('La IA devolvió una respuesta vacía');
            return { texto, proveedor: 'openai', modelo: data.model || model };
        },
    };
};
