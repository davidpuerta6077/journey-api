const { runReport } = require('../../services/reports/runReport');

// Catálogo estático de tipos de reporte disponibles. El front lo consume para
// armar el formulario de parámetros de forma dinámica. Al agregar un tipo nuevo:
// 1) generador en services/reports/, 2) línea en runReport, 3) entrada en tipos.js.
const TIPOS = require('../../services/reports/tipos');

module.exports = (injectedDB) => {
    let data = injectedDB;
    if (!data) data = require('../../database/postgresql');

    function normParams(p) {
        if (p == null) return {};
        if (typeof p !== 'object' || Array.isArray(p)) {
            const err = new Error('params debe ser un objeto');
            err.status = 400;
            throw err;
        }
        return p;
    }

    function tiposDisponibles() {
        return TIPOS;
    }

    async function listReportes() {
        return data.listReports();
    }

    async function getReporte(id) {
        const nid = Number(id);
        if (!Number.isInteger(nid) || nid <= 0) {
            const err = new Error('id de reporte inválido');
            err.status = 400;
            throw err;
        }
        const report = await data.findReportById(nid);
        if (!report) {
            const err = new Error('Reporte no encontrado');
            err.status = 404;
            throw err;
        }
        return report;
    }

    async function createReporte(body, createdByEmail) {
        const { nombre, tipo } = body;
        if (!nombre || !tipo) {
            const err = new Error('nombre y tipo son obligatorios');
            err.status = 400;
            throw err;
        }
        if (!TIPOS.some((t) => t.tipo === tipo)) {
            const err = new Error(`Tipo de reporte no soportado: ${tipo}`);
            err.status = 400;
            throw err;
        }
        const rows = await data.insertReport({
            nombre,
            tipo,
            params: normParams(body.params),
            descripcion: body.descripcion || null,
            created_by: createdByEmail || null,
        });
        return rows[0];
    }

    async function updateReporte(id, body) {
        const actual = await getReporte(id);
        if (body.nombre !== undefined && !body.nombre) {
            const err = new Error('nombre no puede quedar vacío');
            err.status = 400;
            throw err;
        }
        const rows = await data.updateReport(actual.id, {
            nombre: body.nombre ?? actual.nombre,
            params: body.params !== undefined ? normParams(body.params) : actual.params,
            descripcion: body.descripcion ?? actual.descripcion,
        });
        return rows[0];
    }

    async function deleteReporte(id) {
        const def = await getReporte(id);
        await data.deleteReport(def.id);
        return { id: def.id, nombre: def.nombre };
    }

    // onDef: callback opcional que recibe la definición ya cargada (para que la
    // capa de red pueda registrar el nombre del reporte en la auditoría sin
    // hacer una segunda consulta).
    async function ejecutarReporte(id, onDef) {
        const def = await getReporte(id);
        if (typeof onDef === 'function') onDef(def);
        return runReport(def.tipo, def.params || {});
    }

    async function ejecutarAdHoc(tipo, params) {
        if (!tipo) {
            const err = new Error('tipo es obligatorio');
            err.status = 400;
            throw err;
        }
        return runReport(tipo, params || {});
    }

    return {
        tiposDisponibles,
        listReportes,
        getReporte,
        createReporte,
        updateReporte,
        deleteReporte,
        ejecutarReporte,
        ejecutarAdHoc,
    };
};
