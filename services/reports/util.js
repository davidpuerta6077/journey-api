const config = require('../../config');

const MOODLE_SITE_URL = new URL(config.moodle.url).origin;

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

// Enlaces a Moodle para las filas de detalle (el front los muestra como link
// cuando la columna declara `link: '<clave_url>'`).
function moodleCourseUrl(id) {
    return id ? `${MOODLE_SITE_URL}/course/view.php?id=${id}` : null;
}
function moodleUserUrl(id) {
    return id ? `${MOODLE_SITE_URL}/user/profile.php?id=${id}` : null;
}

module.exports = { normCategoryId, normInt, normEnum, meta, moodleCourseUrl, moodleUserUrl };
