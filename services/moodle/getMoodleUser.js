const moodleDB = require('../../database/mysqlMoodle');
const queries = require('../../database/querysets');

async function getMoodleUserByUsername(username) {
    try {
        const query = queries.findMoodleUserByUsername(username);
        const [rows] = await moodleDB.query(query.text, query.values);
        console.log(`Moodle user [${username}]:`, rows);
        return rows.length > 0 ? rows[0] : null;
    } catch (error) {
        console.warn('No se pudo consultar Moodle DB:', error.message);
        return null;
    }
}

module.exports = { getMoodleUserByUsername };