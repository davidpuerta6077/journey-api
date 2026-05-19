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
    //     // schema: process.env.SCHEMA || 'test',
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
        base_url: 'http://localhost:4000/api'  // Agregado
    }
};
