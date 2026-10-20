const { cifrar, descifrar } = require('./ia/secreto');

// Settings que son credenciales: se guardan cifrados con IA_SECRET_KEY, nunca se
// devuelven por la API ni quedan en claro en los logs. (La API key de la IA va
// aparte: services/ia/config.js.)
const SECRETOS = {
    moodle: ['moodle_token'],
};

function esSecreto(categoria, clave) {
    return (SECRETOS[categoria] || []).includes(clave);
}

function valorParaLog(categoria, clave, valor) {
    return esSecreto(categoria, clave) ? '(oculto)' : valor;
}

function cifrarSecreto(valor, env = process.env) {
    return { ...cifrar(valor, env), ultimos: valor.slice(-4) };
}

// Los guardados antes del cifrado siguen en texto plano: se aceptan tal cual.
function leerSecreto(valor, env = process.env) {
    return typeof valor === 'string' ? valor : descifrar(valor, env);
}

const ultimosDe = (valor) => (typeof valor === 'string' ? valor.slice(-4) : valor?.ultimos || '');

module.exports = { esSecreto, valorParaLog, cifrarSecreto, leerSecreto, ultimosDe };
