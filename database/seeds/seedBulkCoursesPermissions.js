// Permisos de Carga Masiva > Cursos (módulo nexo_sync), idempotente.
// Se otorgan a los mismos roles que ya tienen la carga masiva de matrículas
// (bulk_upload_enrollments), para que quien carga matrículas pueda cargar los
// cursos donde va a matricular. Luego se ajustan en Administrador > Permisos.
// Uso: node database/seeds/seedBulkCoursesPermissions.js

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

const MODULE_CODE = 'nexo_sync';
const BASE_SUBMODULE = 'bulk_upload_enrollments';
const SUBMODULES = [
    { code: 'bulk_upload_courses', name: 'Carga Masiva - Cursos' },
    { code: 'upload_excel_courses', name: 'Subir Excel de cursos' },
    { code: 'process_excel_courses', name: 'Procesar Excel de cursos' },
];

async function main() {
    const mod = await pool.query(`SELECT id FROM ${schema}.modules WHERE code = $1`, [MODULE_CODE]);
    if (!mod.rows.length) throw new Error(`No existe el módulo '${MODULE_CODE}'`);
    const moduleId = mod.rows[0].id;

    const roles = (await pool.query(
        `SELECT DISTINCT rp.role_id, r.name FROM ${schema}.role_permissions rp
         JOIN ${schema}.submodules s ON s.id = rp.submodule_id
         JOIN ${schema}.roles r ON r.id = rp.role_id
         WHERE s.code = $1`, [BASE_SUBMODULE])).rows;
    console.log(`Roles con ${BASE_SUBMODULE}: ${roles.map((r) => r.name).join(', ') || '(ninguno)'}`);

    for (const sm of SUBMODULES) {
        let id = (await pool.query(`SELECT id FROM ${schema}.submodules WHERE code = $1`, [sm.code])).rows[0]?.id;
        if (!id) {
            id = (await pool.query(
                `INSERT INTO ${schema}.submodules (module_id, code, name) VALUES ($1, $2, $3) RETURNING id`,
                [moduleId, sm.code, sm.name])).rows[0].id;
            console.log(`  Submódulo '${sm.code}' creado (id=${id})`);
        } else {
            console.log(`  Submódulo '${sm.code}' ya existe (id=${id})`);
        }
        for (const r of roles) {
            const ya = await pool.query(
                `SELECT 1 FROM ${schema}.role_permissions WHERE role_id = $1 AND submodule_id = $2`, [r.role_id, id]);
            if (!ya.rows.length) {
                await pool.query(`INSERT INTO ${schema}.role_permissions (role_id, submodule_id) VALUES ($1, $2)`, [r.role_id, id]);
                console.log(`    otorgado a ${r.name}`);
            }
        }
    }
    console.log('Listo.');
}

main()
    .catch((err) => {
        console.error('Error sembrando permisos de carga de cursos:', err.message);
        process.exitCode = 1;
    })
    .finally(() => pool.end());
