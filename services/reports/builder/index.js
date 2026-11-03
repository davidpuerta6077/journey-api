const { DATASETS } = require('./catalogo');
const { OPERADORES, aplicarFiltros } = require('./filtros');
const { calcularRiesgo } = require('./riesgo');
const { enriquecerMoodle } = require('./moodle');
const { meta } = require('../util');

function error400(msg) {
    const err = new Error(msg);
    err.status = 400;
    return err;
}

// Reporte 'constructor'. params = { dataset, columnas: [key], filtros: [{ col, op, valor }],
// agrupar: [key] (lo usa el front), riesgo: config de riesgo.js }.
// 1) SELECT de las columnas Nexo usadas, 2) filtros sobre columnas Nexo,
// 3) Moodle solo para las filas que quedaron y si se usa alguna columna m_*,
// 4) riesgo, 5) filtros sobre Moodle/riesgo, 6) solo las columnas pedidas.
// deps (tests): { query(def, keys), mysql(text, values), rest(fn, params) }.
async function runConstructor(params = {}, deps = {}) {
    const def = DATASETS[params.dataset];
    if (!def) throw error400(`Conjunto de datos no soportado: ${params.dataset}`);
    const porKey = new Map(def.columnas.map((c) => [c.key, c]));

    // Una columna que ya no existe en el catálogo (reporte guardado viejo) se ignora.
    let columnas = [...new Set((Array.isArray(params.columnas) ? params.columnas : []).filter((k) => porKey.has(k)))];
    if (!columnas.length) columnas = def.defecto;

    const filtros = (Array.isArray(params.filtros) ? params.filtros : []).map((f) => {
        if (!porKey.has(f?.col)) throw error400(`Columna desconocida en filtro: ${f?.col}`);
        if (!OPERADORES.includes(f.op)) throw error400(`Operador no soportado: ${f.op}`);
        return { col: f.col, op: f.op, valor: f.valor };
    });
    const esMoodle = (k) => !!porKey.get(k).moodle;

    const usadas = [...columnas, ...filtros.map((f) => f.col)];
    const conMoodle = usadas.some(esMoodle);
    const conRiesgo = usadas.some((k) => porKey.get(k).grupo === 'Riesgo');
    const keysNexo = [...new Set(usadas.filter((k) => !esMoodle(k)))];
    if (conMoodle) keysNexo.push(...Object.keys(def.claves));
    if (!keysNexo.length) keysNexo.push(def.columnas[0].key);

    const query = deps.query || require('../../../database/postgresql').reportBuilderRows;
    let rows = aplicarFiltros(await query(def, keysNexo), filtros.filter((f) => !esMoodle(f.col)));

    const avisos = [];
    if (conMoodle && rows.length) {
        const r = await enriquecerMoodle(rows, { dataset: params.dataset, mysql: deps.mysql, rest: deps.rest });
        avisos.push(...r.avisos);
    }
    if (conRiesgo) {
        for (const row of rows) {
            const { criterios, nivel } = calcularRiesgo(row, params.riesgo);
            row.riesgo_nivel = nivel;
            row.riesgo_cantidad = criterios.length;
            row.riesgo_criterios = criterios.join('; ');
        }
    }
    rows = aplicarFiltros(rows, filtros.filter((f) => esMoodle(f.col)));

    return {
        columns: columnas.map((k) => {
            const c = porKey.get(k);
            return { key: k, label: c.label, tipo: c.tipo, grupo: c.grupo };
        }),
        rows: rows.map((r) => Object.fromEntries(columnas.map((k) => [k, r[k] ?? null]))),
        meta: { ...meta('constructor', params), avisos },
    };
}

module.exports = { runConstructor };
