const { coursesByCategory } = require('./moodle/coursesByCategory');

// Dispatcher de reportes. Recibe el código de tipo y los parámetros de la
// definición, ejecuta el generador correspondiente y devuelve el formato
// unificado { columns, rows, meta }. Tipo desconocido => Error 400.
async function runReport(tipo, params = {}) {
    switch (tipo) {
        case 'moodle_courses_by_category':
            return coursesByCategory(params);
        default: {
            const err = new Error(`Tipo de reporte no soportado: ${tipo}`);
            err.status = 400;
            throw err;
        }
    }
}

module.exports = { runReport };
