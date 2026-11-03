// Filtros del constructor de reportes. Se aplican en JS sobre las filas ya
// leídas (una sola implementación para columnas de Nexo, de Moodle y de
// riesgo). filtro = { col, op, valor }.
const OPERADORES = ['eq', 'neq', 'contains', 'in', 'empty', 'not_empty', 'gt', 'lt', 'between', 'periodo_actual'];

const vacio = (v) => v === null || v === undefined || v === '';
// Comparación sin mayúsculas ni tildes ("Matrícula" = "matricula").
const norm = (v) => (vacio(v) ? '' : String(v).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim());
const num = (v) => (vacio(v) || typeof v === 'boolean' ? NaN : Number(v));

// < 0, 0, > 0. Números si ambos lo son; si no, texto (las fechas van como
// 'YYYY-MM-DD[ HH:MI]', así que el orden de texto sirve).
function comparar(a, b) {
    const na = num(a), nb = num(b);
    if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
    const sa = String(a), sb = String(b);
    return sa < sb ? -1 : sa > sb ? 1 : 0;
}

// "hasta 2026-10-01" incluye todo ese día aunque el valor traiga hora.
const recortar = (v, ref) => (Number.isFinite(num(v)) && Number.isFinite(num(ref)) ? v : String(v).slice(0, String(ref).length));

function cumple(v, { op, valor }, ctx) {
    switch (op) {
        case 'eq': return norm(v) === norm(valor);
        case 'neq': return norm(v) !== norm(valor);
        case 'contains': return norm(v).includes(norm(valor));
        case 'in': return (Array.isArray(valor) ? valor : [valor]).some((x) => norm(x) === norm(v));
        case 'empty': return vacio(v);
        case 'not_empty': return !vacio(v);
        case 'gt': return !vacio(v) && !vacio(valor) && comparar(v, valor) > 0;
        case 'lt': return !vacio(v) && !vacio(valor) && comparar(v, valor) < 0;
        case 'between': {
            const [desde, hasta] = Array.isArray(valor) ? valor : [];
            if (vacio(v)) return vacio(desde) && vacio(hasta);
            if (!vacio(desde) && comparar(v, desde) < 0) return false;
            if (!vacio(hasta) && comparar(recortar(v, hasta), hasta) > 0) return false;
            return true;
        }
        case 'periodo_actual': return ctx.mayor === undefined || norm(v) === norm(ctx.mayor);
        default: return true;
    }
}

function aplicarFiltros(rows, filtros = []) {
    let out = rows;
    for (const f of filtros) {
        const ctx = {};
        if (f.op === 'periodo_actual') {
            const vals = out.map((r) => r[f.col]).filter((v) => !vacio(v));
            if (vals.length) ctx.mayor = vals.reduce((m, v) => (String(v).localeCompare(String(m), 'es', { numeric: true }) > 0 ? v : m));
        }
        out = out.filter((r) => cumple(r[f.col], f, ctx));
    }
    return out;
}

module.exports = { OPERADORES, aplicarFiltros };
