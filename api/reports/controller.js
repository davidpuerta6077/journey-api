const { runReport } = require('../../services/reports/runReport');

// Catálogo estático de tipos de reporte disponibles. El front lo consume para
// armar el formulario de parámetros de forma dinámica. Al agregar un tipo nuevo:
// 1) generador en services/reports/, 2) case en runReport, 3) entrada aquí.
const TIPOS = [
    {
        tipo: 'moodle_courses_by_category',
        label: 'Cursos y estudiantes por categoría (Moodle)',
        fuente: 'moodle',
        params: [
            { key: 'categoryId', label: 'Categoría (id)', type: 'number', required: false },
            { key: 'incluirSubcategorias', label: 'Incluir subcategorías', type: 'boolean', default: true },
        ],
    },
];

module.exports = (injectedDB) => {
    let data = injectedDB;
    if (!data) data = require('../../database/postgresql');

    function tiposDisponibles() {
        return TIPOS;
    }

    async function listReportes() {
        return data.listReports();
    }

    async function getReporte(id) {
        const report = await data.findReportById(id);
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
            params: body.params || {},
            descripcion: body.descripcion || null,
            created_by: createdByEmail || null,
        });
        return rows[0];
    }

    async function updateReporte(id, body) {
        await getReporte(id);
        const rows = await data.updateReport(id, {
            nombre: body.nombre,
            params: body.params || {},
            descripcion: body.descripcion || null,
        });
        return rows[0];
    }

    async function deleteReporte(id) {
        await getReporte(id);
        await data.deleteReport(id);
        return { id: Number(id) };
    }

    async function ejecutarReporte(id) {
        const def = await getReporte(id);
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
