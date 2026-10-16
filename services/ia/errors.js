// Error de negocio del servicio de IA. `status` lo usa el middleware de errores
// de api/index.js para responder (503: IA no configurada o caída; 422: la IA se
// negó a generar el texto).
function iaError(message, status = 503) {
    const err = new Error(message);
    err.status = status;
    return err;
}

module.exports = { iaError };
