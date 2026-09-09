// Interpreta la respuesta de moodleRequest (services/moodleService.js), que nunca lanza:
// null = Moodle no respondió (moodleService.js traga el error de axios/timeout y devuelve null);
// .exception = Moodle respondió pero rechazó la operación (error de negocio, con mensaje legible).
function assertMoodleOk(result, contextMessage) {
    if (result === null) {
        throw new Error(`${contextMessage}: Moodle no respondió (posible caída o timeout)`);
    }
    if (result?.exception) {
        throw new Error(`${contextMessage}: ${result.message || result.exception}`);
    }
    return result;
}

module.exports = { assertMoodleOk };
