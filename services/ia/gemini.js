const { iaError } = require('./errors');

// Proveedor Google Gemini (API de Google AI Studio). La key va en header, no en la URL.
module.exports = function createGemini({ fetchFn = fetch, apiKey, model }) {
    return {
        async generar({ system, prompt }) {
            let res;
            try {
                res = await fetchFn(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
                    body: JSON.stringify({
                        systemInstruction: { parts: [{ text: system }] },
                        contents: [{ role: 'user', parts: [{ text: prompt }] }],
                    }),
                    signal: AbortSignal.timeout(120000),
                });
            } catch {
                throw iaError('Gemini no respondió');
            }
            if (res.status === 400 || res.status === 401 || res.status === 403) throw iaError('La API key de Gemini no es válida o el modelo no existe');
            if (res.status === 429) throw iaError('Gemini está saturado o se agotó la cuota, intenta de nuevo en unos minutos');
            if (!res.ok) throw iaError(`Gemini respondió con error ${res.status}`);
            const data = await res.json().catch(() => null);
            const texto = (data?.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('').trim();
            if (!texto) throw iaError('La IA devolvió una respuesta vacía');
            return { texto, proveedor: 'gemini', modelo: model };
        },
    };
};
