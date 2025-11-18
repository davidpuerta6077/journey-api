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
    postgresql: {
        host: process.env.POSTGRESQL_HOST || 'localhost',
        user: process.env.POSTGRESQL_USER || 'postgres',
        password: process.env.POSTGRESQL_PASSWORD || 'contraseña',
        database: process.env.POSTGRESQL_DB || 'sb-data'
    },
    domain: {
        url_base: process.env.URL_BASE || 'https://localhost:3001'
    }, 
    moodle_token: 'a9667c932d294bca8924ec0888140768'
}
