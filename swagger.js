const swaggerJsdoc = require('swagger-jsdoc');

const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Journey API',
            version: '1.0.0',
            description: 'Documentación de la API del sistema Journey',
        },

        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT'
                }
            },
            schemas: {
                // ─── AUTH ─────────────────────────────────────────
                LoginRequest: {
                    type: 'object',
                    required: ['email', 'password'],
                    properties: {
                        email:    { type: 'string', example: 'admin@journey.com' },
                        password: { type: 'string', example: '123456' }
                    }
                },
                LoginResponse: {
                    type: 'object',
                    properties: {
                        token: { type: 'string' },
                        user: {
                            type: 'object',
                            properties: {
                                id:       { type: 'integer' },
                                username: { type: 'string' },
                                email:    { type: 'string' },
                                rol:      { type: 'string' }
                            }
                        }
                    }
                },
                // ─── USERS ────────────────────────────────────────
                User: {
                    type: 'object',
                    properties: {
                        id:                    { type: 'integer' },
                        username:              { type: 'string' },
                        firstname:             { type: 'string' },
                        lastname:              { type: 'string' },
                        email:                 { type: 'string' },
                        documento:             { type: 'string' },
                        correo_personal:       { type: 'string' },
                        telefono:              { type: 'string' },
                        celular:               { type: 'string' },
                        fecha_nacimiento:      { type: 'string', format: 'date' },
                        jornada:               { type: 'string' },
                        departamento_academico:{ type: 'string' },
                        plan_estudios:         { type: 'string' },
                        moodle_id:             { type: 'integer' },
                        city:                  { type: 'string' },
                        country:               { type: 'string' }
                    }
                },
                // ─── COURSES ──────────────────────────────────────
                Course: {
                    type: 'object',
                    properties: {
                        id:            { type: 'integer' },
                        fullname:      { type: 'string' },
                        shortname:     { type: 'string' },
                        categoryid:    { type: 'integer' },
                        idnumber:      { type: 'string' },
                        summary:       { type: 'string' },
                        visible:       { type: 'boolean' },
                        format:        { type: 'string' },
                        numsections:   { type: 'integer' },
                        moodle_id:     { type: 'integer' },
                        seed_course_id:{ type: 'integer' }
                    }
                },
                // ─── ENROLLMENTS ──────────────────────────────────
                Enrollment: {
                    type: 'object',
                    properties: {
                        id:                    { type: 'integer' },
                        userid:                { type: 'integer' },
                        courseid:              { type: 'integer' },
                        role:                  { type: 'string' },
                        moodle_enrollment_id:  { type: 'integer' },
                        codigo_asignatura:     { type: 'string' },
                        nombre_asignatura:     { type: 'string' },
                        programa:              { type: 'string' },
                        periodo:               { type: 'string' },
                        grupo:                 { type: 'string' },
                        codigo_journey:        { type: 'string' },
                        estado:                { type: 'string' },
                        fecha_creacion_journey:{ type: 'string', format: 'date' }
                    }
                },
                // ─── RESPUESTAS GENÉRICAS ─────────────────────────
                SuccessResponse: {
                    type: 'object',
                    properties: {
                        error:   { type: 'boolean', example: false },
                        status:  { type: 'integer', example: 200 },
                        body:    { type: 'object' }
                    }
                },
                ErrorResponse: {
                    type: 'object',
                    properties: {
                        error:   { type: 'boolean', example: true },
                        status:  { type: 'integer', example: 400 },
                        body:    { type: 'string', example: 'Mensaje de error' }
                    }
                }
            }
        }
    },
    // Aquí le dices dónde buscar las anotaciones JSDoc
    apis: ['./api/**/*.js']
};

module.exports = swaggerJsdoc(options);