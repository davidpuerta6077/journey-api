// Cuenta Moodle vía plugin local_nexo (desbloqueo y reinicio de MFA). Única escritura
// a Moodle por webservice permitida — ver CLAUDE.md, sección Integraciones externas.
const { moodleRequest } = require('./moodleService');
const config = require('../config');

const PLUGIN_ERRORS = {
    usernotfound: 404,
    multipleusers: 409,
    userprotected: 409,
    authnotallowed: 409,
    actiondisabled: 409,
};

const httpError = (message, statusCode) => Object.assign(new Error(message), { statusCode });

module.exports = (request = moodleRequest, token = config.moodle.nexo_token || config.moodle_token) => {
    const call = async (wsfunction, params) => {
        const data = await request(wsfunction, params, 15000, token);
        if (data === null || data === undefined) {
            throw httpError('No se pudo contactar a Moodle', 502);
        }
        if (typeof data !== 'object' || Array.isArray(data)) {
            throw httpError('Respuesta inválida de Moodle (¿plugin Nexo instalado?)', 502);
        }
        if (data.exception) {
            const status = PLUGIN_ERRORS[data.errorcode];
            if (status) throw httpError(data.message, status);
            throw httpError(`Moodle rechazó la solicitud (¿plugin Nexo instalado y token con acceso?): ${data.message}`, 502);
        }
        return data;
    };

    return {
        getStatus: (documento) => call('local_nexo_get_user_status', { identifier: documento }),
        unlock: (documento, actor) => call('local_nexo_unlock_user', { identifier: documento, actor }),
        resetMfa: (documento, actor) => call('local_nexo_reset_mfa', { identifier: documento, actor }),
    };
};
