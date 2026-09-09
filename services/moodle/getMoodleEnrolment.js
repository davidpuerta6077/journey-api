const moodleDB = require('../../database/mysqlMoodle');
const queries = require('../../database/querysets');

// El webservice manual de matriculación de Moodle no devuelve el id interno de la
// matrícula; se lee directo de la BD de Moodle (mismo patrón que getMoodleUser.js).
async function getMoodleEnrolmentId(courseMoodleId, userMoodleId) {
    try {
        const query = queries.findMoodleEnrolmentId(courseMoodleId, userMoodleId);
        const [rows] = await moodleDB.query(query.text, query.values);
        return rows.length > 0 ? rows[0].id : null;
    } catch (error) {
        console.warn('No se pudo consultar el id de matrícula en Moodle DB:', error.message);
        return null;
    }
}

module.exports = { getMoodleEnrolmentId };
