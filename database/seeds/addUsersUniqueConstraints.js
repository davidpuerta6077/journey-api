// Garantiza que en users no haya dos filas para la misma persona: documento
// único y email/username únicos (sin distinguir mayúsculas). Un estudiante
// puede tener muchas matrículas, pero un solo usuario.
//
// Si ya hay duplicados el script los lista y aborta sin tocar nada: hay que
// resolverlos a mano (reasignar sus matrículas a la fila que se conserve y
// quitar las demás) y volver a correrlo.
// Idempotente: CREATE UNIQUE INDEX IF NOT EXISTS no falla si ya existen.
// Uso: node database/seeds/addUsersUniqueConstraints.js

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

async function main() {
    let hayDuplicados = false;
    for (const col of ['documento', 'lower(email)', 'lower(username)']) {
        const rep = await pool.query(`
            SELECT ${col} AS valor, array_agg(id ORDER BY id) AS ids
            FROM ${schema}.users
            WHERE ${col} IS NOT NULL
            GROUP BY ${col} HAVING count(*) > 1`);
        rep.rows.forEach(r => console.error(`${col} repetido "${r.valor}" en ids ${r.ids.join(', ')}`));
        if (rep.rows.length > 0) hayDuplicados = true;
    }
    if (hayDuplicados) {
        throw new Error('Hay usuarios duplicados; resolverlos antes de crear los índices únicos');
    }

    console.log(`Creando índices únicos en ${schema}.users (si no existen)...`);
    await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS users_documento_uniq ON ${schema}.users (documento)`);
    await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS users_email_uniq ON ${schema}.users (lower(email))`);
    await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS users_username_uniq ON ${schema}.users (lower(username))`);
    console.log('Listo.');
}

main()
    .catch((err) => {
        console.error('Error agregando restricciones únicas a users:', err.message);
        process.exitCode = 1;
    })
    .finally(() => pool.end());
