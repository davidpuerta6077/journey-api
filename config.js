module.exports = {
    api: {
        port: process.env.API_PORT || 3001,
    },
    postgresqlService: {
        host: process.env.API_HOST || 'localhost',
        port: process.env.POSTGRESQL_SERVICE_PORT || 4000,
    },
    jwt: {
        secret: process.env.JWT_SECRET,
    },
    postgresql: {
        host:     process.env.POSTGRESQL_HOST,
        user:     process.env.POSTGRESQL_USER,
        password: process.env.POSTGRESQL_PASSWORD,
        database: process.env.POSTGRESQL_DB,
        schema:   process.env.SCHEMA   || 'test',
        port:     process.env.DB_PORT  || 5432,
    },
    domain: {
        url_base: process.env.URL_BASE || 'http://localhost:3001'
    },
    moodle_token: process.env.MOODLE_TOKEN,
    university_api: {
        base_url: 'http://localhost:4000/api'
    },
    moodle_db: {
        host:     process.env.MOODLE_DB_HOST,
        user:     process.env.MOODLE_DB_USER,
        password: process.env.MOODLE_DB_PASSWORD,
        database: process.env.MOODLE_DB_NAME,
    },
    moodle: {
        url:   process.env.MOODLE_URL,
        token: process.env.MOODLE_TOKEN,
    },
    moodle_cli: {
        php_path:    process.env.PHP_PATH    || 'C:\\xampp\\php\\php.exe',
        moodle_path: process.env.MOODLE_PATH || 'C:\\xampp\\htdocs\\MoodleCinco\\moodle',
    },
};