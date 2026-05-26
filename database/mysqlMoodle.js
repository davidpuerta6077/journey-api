const mysql = require('mysql2/promise');
const config = require('../config');

const moodleDB = mysql.createPool({
    host:     config.moodle_db.host,
    user:     config.moodle_db.user,
    password: config.moodle_db.password,
    database: config.moodle_db.database
});

module.exports = moodleDB;