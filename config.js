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
        host: process.env.POSTGRESQL_HOST || 'postgrespascualbravo.cygtmjsaacoj.us-east-1.rds.amazonaws.com',
        user: process.env.POSTGRESQL_USER || 'journey',
        password: process.env.POSTGRESQL_PASSWORD || '655HVycyfc579ihbi',
        database: process.env.POSTGRESQL_DB || 'journey',
        schema: process.env.SCHEMA || 'test',
        port: process.env.DB_PORT || 5432, 

    // CAMBIO 2: AWS RDS casi siempre requiere esto para conexiones externas/seguras
        ssl: {
            rejectUnauthorized: false 
        },

    // CAMBIO 3: Define un timeout explícito (opcional, ayuda a no esperar infinitamente)
        connectionTimeoutMillis: 5000 
        
    },
    domain: {
        url_base: process.env.URL_BASE || 'https://localhost:3001'
    }, 
    moodle_token: 'a9667c932d294bca8924ec0888140768'
}
