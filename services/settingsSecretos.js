// Settings que son credenciales: nunca se devuelven por la API ni quedan en
// claro en los logs. (La API key de la IA va aparte, cifrada: services/ia/config.js.)
const SECRETOS = {
    moodle: ['moodle_token'],
};

function esSecreto(categoria, clave) {
    return (SECRETOS[categoria] || []).includes(clave);
}

function valorParaLog(categoria, clave, valor) {
    return esSecreto(categoria, clave) ? '(oculto)' : valor;
}

module.exports = { esSecreto, valorParaLog };
