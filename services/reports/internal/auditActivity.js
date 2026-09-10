const db = require('../../../database/postgresql');
const config = require('../../../config');
const { meta, normInt, normEnum } = require('../_util');
const schema = config.postgresql.schema;

async function auditActivity(params = {}) {
    const dias = normInt(params.dias, 30);
    const agruparPor = normEnum(params.agruparPor, ['usuario', 'modulo', 'dia'], 'usuario');

    let text;
    let columns;
    let mapRow;

    if (agruparPor === 'modulo') {
        text = `SELECT COALESCE(m.name,'(sin módulo)') AS aplicacion,
                       COALESCE(sm.name, l.entity_type, '(sin submódulo)') AS modulo,
                       COUNT(*)::int AS acciones
                FROM ${schema}.logs l
                LEFT JOIN ${schema}.submodules sm ON sm.code = l.entity_type
                LEFT JOIN ${schema}.modules m ON m.id = sm.module_id
                WHERE l.date >= now() - ($1 || ' days')::interval
                GROUP BY 1,2 ORDER BY acciones DESC`;
        columns = [
            { key: 'aplicacion', label: 'Aplicación' },
            { key: 'modulo', label: 'Módulo' },
            { key: 'acciones', label: 'Acciones' },
        ];
        mapRow = (r) => ({ aplicacion: r.aplicacion, modulo: r.modulo, acciones: r.acciones });
    } else if (agruparPor === 'dia') {
        text = `SELECT to_char(date_trunc('day', date),'YYYY-MM-DD') AS dia, COUNT(*)::int AS acciones
                FROM ${schema}.logs
                WHERE date >= now() - ($1 || ' days')::interval
                GROUP BY 1 ORDER BY dia DESC`;
        columns = [
            { key: 'dia', label: 'Día' },
            { key: 'acciones', label: 'Acciones' },
        ];
        mapRow = (r) => ({ dia: r.dia, acciones: r.acciones });
    } else {
        text = `SELECT COALESCE(username,'(anónimo)') AS usuario, COUNT(*)::int AS acciones
                FROM ${schema}.logs
                WHERE date >= now() - ($1 || ' days')::interval
                GROUP BY 1 ORDER BY acciones DESC`;
        columns = [
            { key: 'usuario', label: 'Usuario' },
            { key: 'acciones', label: 'Acciones' },
        ];
        mapRow = (r) => ({ usuario: r.usuario, acciones: r.acciones });
    }

    const rows = await db.query({ text, values: [String(dias)] });
    return {
        columns,
        rows: rows.map(mapRow),
        meta: meta('journey_audit_activity', { dias, agruparPor }),
    };
}
module.exports = { auditActivity };
