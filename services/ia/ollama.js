const { iaError } = require('./errors');

// Proveedor Ollama (IA local de la institución).
module.exports = function createOllama({ fetchFn = fetch, url, model }) {
    return {
        async generar({ system, prompt }) {
            let res;
            try {
                res = await fetchFn(`${url.replace(/\/$/, '')}/api/generate`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ model, system, prompt, stream: false }),
                    signal: AbortSignal.timeout(120000),
                });
            } catch {
                throw iaError('La IA local (Ollama) no respondió');
            }
            if (!res.ok) throw iaError(`La IA local (Ollama) respondió con error ${res.status}`);
            const data = await res.json().catch(() => null);
            const texto = (data?.response || '').trim();
            if (!texto) throw iaError('La IA devolvió una respuesta vacía');
            return { texto, proveedor: 'ollama', modelo: model };
        },
    };
};
