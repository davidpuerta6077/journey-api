const mysql = require('mysql2/promise');
const config = require('../config');

const moodleDB = mysql.createPool({
    host:     config.moodle_db.host,
    user:     config.moodle_db.user,
    password: config.moodle_db.password,
    database: config.moodle_db.database,
    // Si la BD de Moodle no es alcanzable (entorno sin VPN/bastión a la RDS),
    // fallar en ~8s en vez de colgar ~20s: los consumidores con fallback
    // (p.ej. reportes) pueden pasar a la REST API cuanto antes.
    connectTimeout: 8000
});

module.exports = moodleDB;