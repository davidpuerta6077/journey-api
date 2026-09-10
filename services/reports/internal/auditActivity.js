const db = require('../../../database/postgresql');
const { meta, normInt, normEnum } = require('../_util');

async function auditActivity(params = {}) {
    const dias = normInt(params.dias, 30);
    const agruparPor = normEnum(params.agruparPor, ['usuario', 'modulo', 'dia'], 'usuario');

    let columns;
    let mapRow;

    if (agruparPor === 'modulo') {
        columns = [
            { key: 'aplicacion', label: 'Aplicación' },
            { key: 'modulo', label: 'Módulo' },
            { key: 'acciones', label: 'Acciones' },
        ];
        mapRow = (r) => ({ aplicacion: r.aplicacion, modulo: r.modulo, acciones: r.acciones });
    } else if (agruparPor === 'dia') {
        columns = [
            { key: 'dia', label: 'Día' },
            { key: 'acciones', label: 'Acciones' },
        ];
        mapRow = (r) => ({ dia: r.dia, acciones: r.acciones });
    } else {
        columns = [
            { key: 'usuario', label: 'Usuario' },
            { key: 'acciones', label: 'Acciones' },
        ];
        mapRow = (r) => ({ usuario: r.usuario, acciones: r.acciones });
    }

    const rows = await db.reportAuditActivity({ dias, agruparPor });
    return {
        columns,
        rows: rows.map(mapRow),
        meta: meta('journey_audit_activity', { dias, agruparPor }),
    };
}
module.exports = { auditActivity };
