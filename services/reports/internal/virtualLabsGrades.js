const db = require('../../../database/postgresql');
const config = require('../../../config');
const { meta, normEnum } = require('../_util');
const schema = config.postgresql.schema;

async function virtualLabsGrades(params = {}) {
    const agruparPor = normEnum(params.agruparPor, ['curso', 'estudiante', 'detalle'], 'curso');

    let text;
    let columns;
    let mapRow;

    if (agruparPor === 'estudiante') {
        text = `SELECT id_estudiante, correo, COUNT(*)::int AS calificaciones,
                       ROUND(AVG(calificacion)::numeric,2) AS promedio
                FROM ${schema}.labs_grades
                GROUP BY id_estudiante, correo ORDER BY promedio DESC NULLS LAST`;
        columns = [
            { key: 'id_estudiante', label: 'Estudiante' },
            { key: 'correo', label: 'Correo' },
            { key: 'calificaciones', label: 'N.º calificaciones' },
            { key: 'promedio', label: 'Promedio' },
        ];
        mapRow = (r) => ({ id_estudiante: r.id_estudiante, correo: r.correo, calificaciones: r.calificaciones, promedio: r.promedio });
    } else if (agruparPor === 'detalle') {
        text = `SELECT id, id_estudiante, correo, id_curso, calificacion, created_at
                FROM ${schema}.labs_grades ORDER BY created_at DESC`;
        columns = [
            { key: 'id', label: 'ID' },
            { key: 'id_estudiante', label: 'Estudiante' },
            { key: 'correo', label: 'Correo' },
            { key: 'id_curso', label: 'Curso' },
            { key: 'calificacion', label: 'Calificación' },
            { key: 'created_at', label: 'Fecha' },
        ];
        mapRow = (r) => ({
            id: r.id,
            id_estudiante: r.id_estudiante,
            correo: r.correo,
            id_curso: r.id_curso,
            calificacion: r.calificacion,
            created_at: r.created_at,
        });
    } else {
        text = `SELECT id_curso, COUNT(*)::int AS calificaciones,
                       ROUND(AVG(calificacion)::numeric,2) AS promedio,
                       MIN(calificacion) AS minima, MAX(calificacion) AS maxima
                FROM ${schema}.labs_grades GROUP BY id_curso ORDER BY id_curso`;
        columns = [
            { key: 'id_curso', label: 'Curso' },
            { key: 'calificaciones', label: 'N.º calificaciones' },
            { key: 'promedio', label: 'Promedio' },
            { key: 'minima', label: 'Mínima' },
            { key: 'maxima', label: 'Máxima' },
        ];
        mapRow = (r) => ({
            id_curso: r.id_curso,
            calificaciones: r.calificaciones,
            promedio: r.promedio,
            minima: r.minima,
            maxima: r.maxima,
        });
    }

    const rows = await db.query({ text, values: [] });
    return {
        columns,
        rows: rows.map(mapRow),
        meta: meta('journey_virtual_labs_grades', { agruparPor }),
    };
}
module.exports = { virtualLabsGrades };
