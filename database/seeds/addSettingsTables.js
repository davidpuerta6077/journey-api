// Crea las tablas del apartado Configuración:
//
//  - settings: valores sueltos clave-valor por categoría (apariencia, home,
//    sistema...). Un valor por fila (categoria, clave) -> valor JSONB, para
//    poder guardar strings, booleanos, colores o estructuras pequeñas sin
//    columnas nuevas por cada setting futuro.
//  - menu_links: la lista editable de accesos externos del sidebar (nombre,
//    url, si abre en pestaña nueva, orden). Es una colección, no un valor
//    suelto, por eso va en su propia tabla y no dentro de settings. Solo
//    cubre enlaces EXTERNOS: un ítem de menú que apunte a una ruta interna
//    protegida sigue atado a submodule_code/checkPermission/SideNavItems.jsx
//    y no se vuelve editable aquí.
//
// Idempotente. Uso: node database/seeds/addSettingsTables.js

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
    await pool.query(`
        CREATE TABLE IF NOT EXISTS ${schema}.settings (
            id          SERIAL PRIMARY KEY,
            categoria   TEXT NOT NULL,
            clave       TEXT NOT NULL,
            valor       JSONB NOT NULL DEFAULT 'null'::jsonb,
            updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_by  TEXT
        )
    `);
    await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS settings_categoria_clave_uniq ON ${schema}.settings (categoria, clave)`);
    console.log(`Tabla ${schema}.settings lista.`);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS ${schema}.menu_links (
            id             SERIAL PRIMARY KEY,
            nombre         TEXT NOT NULL,
            url            TEXT NOT NULL,
            icono          TEXT,
            nueva_pestana  BOOLEAN NOT NULL DEFAULT true,
            activo         BOOLEAN NOT NULL DEFAULT true,
            orden          INTEGER NOT NULL DEFAULT 0,
            created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);
    console.log(`Tabla ${schema}.menu_links lista.`);
}

main()
    .catch((err) => {
        console.error('Error creando las tablas de settings/menu_links:', err.message);
        process.exitCode = 1;
    })
    .finally(() => pool.end());
