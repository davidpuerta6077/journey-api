function normCategoryId(v) {
    const n = Number(v);
    return v != null && v !== '' && Number.isFinite(n) ? n : null;
}
function normInt(v, def, { min = 1 } = {}) {
    const n = Number(v);
    return Number.isInteger(n) && n >= min ? n : def;
}
function normEnum(v, allowed, def) {
    return allowed.includes(v) ? v : def;
}
function meta(tipo, params) {
    return { tipo, params, generatedAt: new Date().toISOString() };
}
module.exports = { normCategoryId, normInt, normEnum, meta };
