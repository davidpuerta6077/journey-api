// Reportes de entrada del constructor (tipo 'constructor'): estudiantes que
// nunca entraron, sin acceso, en riesgo y matriculados que no aparecen en
// Moodle. Población base: estudiantes, matrículas no canceladas, periodo más
// reciente (filtro dinámico). Idempotente por nombre. Si VERSION cambia, los
// reportes sembrados por el sistema (created_by = 'sistema') toman los params nuevos.
// Uso: node database/seeds/seedConstructorReports.js

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

const VERSION = '2';

const BASE = [
    { col: 'e_role', op: 'eq', valor: 'Estudiante' },
    { col: 'e_estado', op: 'neq', valor: 'Cancelado' },
    { col: 'e_estado', op: 'neq', valor: 'Desmatriculado' },
    { col: 'e_periodo', op: 'periodo_actual' },
];
const ESTUDIANTE = ['u_nombre_completo', 'u_documento', 'u_email', 'u_celular', 'e_nombre_asignatura', 'e_programa', 'e_grupo', 'c_nombre_profesor', 'e_periodo'];

const REPORTES = [
    {
        nombre: 'Nunca entraron al curso',
        descripcion: 'Estudiantes matriculados en el periodo actual que no han entrado a su curso en Moodle.',
        params: {
            dataset: 'matriculas',
            columnas: [...ESTUDIANTE, 'm_ultimo_acceso_plataforma'],
            filtros: [...BASE, { col: 'm_nunca_entro_curso', op: 'eq', valor: true }],
            agrupar: ['e_programa', 'e_nombre_asignatura'],
            vista: { sustantivo: 'estudiantes' },
        },
    },
    {
        nombre: 'Sin entrar hace más de 7 días',
        descripcion: 'Estudiantes que entraron al curso pero llevan más de 7 días sin volver.',
        params: {
            dataset: 'matriculas',
            columnas: ['u_nombre_completo', 'm_dias_sin_entrar_curso', 'm_ultimo_acceso_curso', ...ESTUDIANTE.slice(1)],
            filtros: [...BASE, { col: 'm_dias_sin_entrar_curso', op: 'gt', valor: 7 }],
            agrupar: ['e_programa', 'e_nombre_asignatura'],
            vista: { sustantivo: 'estudiantes' },
        },
    },
    {
        nombre: 'Estudiantes en riesgo',
        descripcion: 'Riesgo por acceso, calificación, entregas vencidas y avance. Los criterios se ajustan en Personalizar.',
        params: {
            dataset: 'matriculas',
            columnas: ['u_nombre_completo', 'riesgo_nivel', 'riesgo_criterios', 'e_nombre_asignatura', 'e_programa', 'm_dias_sin_entrar_curso', 'm_calificacion', 'm_entregas_vencidas', 'm_avance', 'u_documento', 'u_email', 'u_celular', 'c_nombre_profesor'],
            filtros: [...BASE, { col: 'riesgo_nivel', op: 'neq', valor: 'Sin riesgo' }],
            agrupar: ['riesgo_nivel', 'e_programa'],
            vista: { sustantivo: 'estudiantes en riesgo' },
        },
    },
    {
        nombre: 'Matriculados en Nexo que no aparecen en Moodle',
        descripcion: 'Matrículas del periodo actual en Nexo que Moodle todavía no tiene aplicadas.',
        params: {
            dataset: 'matriculas',
            columnas: ['u_nombre_completo', 'u_documento', 'e_nombre_asignatura', 'e_grupo', 'e_programa', 'e_sincronizado', 'e_estado_sync', 'm_en_moodle'],
            filtros: [...BASE, { col: 'm_matricula_en_moodle', op: 'eq', valor: false }],
            agrupar: ['e_sincronizado', 'e_programa'],
            vista: { sustantivo: 'matrículas' },
        },
    },
];

async function main() {
    console.log(`Sembrando reportes del constructor en schema '${schema}'...`);
    for (const r of REPORTES) {
        const params = JSON.stringify({ ...r.params, version: VERSION });
        const { rowCount } = await pool.query(
            `INSERT INTO ${schema}.reports (nombre, tipo, params, descripcion, created_by)
             SELECT $1, 'constructor', $2::jsonb, $3, 'sistema'
             WHERE NOT EXISTS (SELECT 1 FROM ${schema}.reports WHERE nombre = $1)`,
            [r.nombre, params, r.descripcion],
        );
        if (rowCount) {
            console.log(`Creado: ${r.nombre}`);
            continue;
        }
        const upd = await pool.query(
            `UPDATE ${schema}.reports SET params = $2::jsonb, descripcion = $3, updated_at = now()
             WHERE nombre = $1 AND tipo = 'constructor' AND created_by = 'sistema'
               AND params->>'version' IS DISTINCT FROM $4`,
            [r.nombre, params, r.descripcion, VERSION],
        );
        console.log(`${upd.rowCount ? 'Actualizado' : 'Ya estaba al día'}: ${r.nombre}`);
    }
    console.log('Listo.');
}

main()
    .catch((err) => {
        console.error('Error sembrando reportes del constructor:', err.message);
        process.exitCode = 1;
    })
    .finally(() => pool.end());
