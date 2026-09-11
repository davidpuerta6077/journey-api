const db = require('../../../database/postgresql');
const { meta, normEnum } = require('../util');

async function virtualLabsGrades(params = {}) {
    const agruparPor = normEnum(params.agruparPor, ['curso', 'estudiante', 'detalle'], 'curso');

    let columns;
    let mapRow;

    if (agruparPor === 'estudiante') {
        columns = [
            { key: 'id_estudiante', label: 'Estudiante' },
            { key: 'correo', label: 'Correo' },
            { key: 'calificaciones', label: 'N.º calificaciones' },
            { key: 'promedio', label: 'Promedio' },
        ];
        mapRow = (r) => ({ id_estudiante: r.id_estudiante, correo: r.correo, calificaciones: r.calificaciones, promedio: r.promedio });
    } else if (agruparPor === 'detalle') {
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

    const rows = await db.reportVirtualLabsGrades({ agruparPor });
    return {
        columns,
        rows: rows.map(mapRow),
        meta: meta('journey_virtual_labs_grades', { agruparPor }),
    };
}
module.exports = { virtualLabsGrades };
