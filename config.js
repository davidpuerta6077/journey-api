module.exports = {
    api: {
        port: process.env.API_PORT || 3001,
    },
    postgresqlService: {
        host: process.env.API_HOST || 'localhost',
        port: process.env.API_PORT || 4000,
    },
    jwt: {
        secret: process.env.JWT_SECRET || 'ConfSecret',
    },
    // postgresql: {
    //     host: process.env.POSTGRESQL_HOST || 'postgrespascualbravo.cygtmjsaacoj.us-east-1.rds.amazonaws.com',
    //     user: process.env.POSTGRESQL_USER || 'journey',
    //     password: process.env.POSTGRESQL_PASSWORD || '655HVycyfc579ihbi',
    //     database: process.env.POSTGRESQL_DB || 'journey',
    //     schema: process.env.SCHEMA || 'test',
    //     port: process.env.DB_PORT || 5432,
        postgresql: {
        host: process.env.POSTGRESQL_HOST || '127.0.0.1',
        user: process.env.POSTGRESQL_USER || 'evarango',
        password: process.env.POSTGRESQL_PASSWORD || '865ugvYTC5cygu',
        database: process.env.POSTGRESQL_DB || 'journey',
        schema: process.env.SCHEMA || 'test',
        port: process.env.DB_PORT || 5434, 
    },
    domain: {
        url_base: process.env.URL_BASE || 'https://localhost:3001'
    },
    moodle_token: 'a9667c932d294bca8924ec0888140768',
    university_api: {
        base_url: 'http://localhost:4000/api'
    },
    moodle_db: {
        // local:
        // host: process.env.MOODLE_DB_HOST || 'localhost',
        // user: process.env.MOODLE_DB_USER || 'root',
        // password: process.env.MOODLE_DB_PASSWORD || '',
        // database: process.env.MOODLE_DB_NAME || 'moodle_cinco'
        // producción:
        host: process.env.MOODLE_DB_HOST || 'rdspascualbravo.cygtmjsaacoj.us-east-1.rds.amazonaws.com',
        user: process.env.MOODLE_DB_USER || 'campus_moodle50',
        password: process.env.MOODLE_DB_PASSWORD || 'ks6Xj8ADInsHUtKr',
        database: process.env.MOODLE_DB_NAME || 'campus_moodle50'
    },
    moodle: {
        url: process.env.MOODLE_URL || 'https://moodle50.pascualbravovirtual.edu.co/webservice/rest/server.php',
        token: process.env.MOODLE_TOKEN || 'a9667c932d294bca8924ec0888140768'
    },
    moodle_cli: {
        php_path: process.env.PHP_PATH || 'C:\\xampp\\php\\php.exe',
        moodle_path: process.env.MOODLE_PATH || 'C:\\xampp\\htdocs\\MoodleCinco\\moodle'
    },
};