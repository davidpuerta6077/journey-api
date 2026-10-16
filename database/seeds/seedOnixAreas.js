// Áreas fijas de Informes (Onix-IA): Tecnología, Pedagogía y Comunicaciones.
// Cada usuario elige la suya en su perfil. Idempotente.
// Uso: node database/seeds/seedOnixAreas.js

const { Pool } = require('pg');
const config = require('../../config');

const pool = new Pool({
    database: config.postgresql.database,
    user:     config.postgresql.user,
    password: config.postgresql.password,
    host:     config.postgresql.host,
    port:     config.postgresql.port,
});
const schema = config.postgresql.schema;

const AREAS = [
    ['Tecnología', '#19445e'],
    ['Pedagogía', '#2e7d32'],
    ['Comunicaciones', '#c2410c'],
];

async function main() {
    console.log(`Creando áreas de Informes en schema '${schema}'...`);
    for (const [nombre, color] of AREAS) {
        await pool.query(
            `INSERT INTO ${schema}.onix_areas (nombre, color) VALUES ($1, $2) ON CONFLICT (nombre) DO NOTHING`,
            [nombre, color],
        );
    }
    console.log('Listo.');
}

main()
    .catch((err) => {
        console.error('Error creando áreas de Informes:', err.message);
        process.exitCode = 1;
    })
    .finally(() => pool.end());
