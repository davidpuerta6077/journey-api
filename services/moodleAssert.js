// Interpreta la respuesta de moodleRequest (services/moodleService.js), que nunca lanza:
// null = Moodle no respondió (moodleService.js traga el error de axios/timeout y devuelve null);
// .exception = Moodle respondió pero rechazó la operación (error de negocio, con mensaje legible);
// .warnings = Moodle respondió 200 pero no aplicó el cambio en algún curso del lote (p.ej.
// core_course_update_courses con un idnumber que ya usa otro curso: no lanza excepción, solo
// devuelve un warning y sigue de largo). Sin este chequeo, ese warning se ignoraba en silencio
// y el curso quedaba marcado como sincronizado sin que el idnumber real se haya aplicado.
function assertMoodleOk(result, contextMessage) {
    if (result === null) {
        throw new Error(`${contextMessage}: Moodle no respondió (posible caída o timeout)`);
    }
    if (result?.exception) {
        throw new Error(`${contextMessage}: ${result.message || result.exception}`);
    }
    if (Array.isArray(result?.warnings) && result.warnings.length > 0) {
        const detalle = result.warnings.map(w => w.message || w.warningcode).join('; ');
        throw new Error(`${contextMessage}: ${detalle}`);
    }
    return result;
}

module.exports = { assertMoodleOk };
