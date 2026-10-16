const crypto = require('crypto');

// Google Calendar (solo lectura) para Informes: OAuth por usuario y lectura de
// eventos del mes. Credencial en GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET;
// GOOGLE_REDIRECT_URI debe estar registrada en esa credencial.
const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
const EVENTS_URL = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';
const SCOPES = ['openid', 'email', 'https://www.googleapis.com/auth/calendar.readonly'];
const ESTADO_VIGENCIA = 10 * 60 * 1000;
// Bloques del calendario que no son trabajo hecho.
const TIPOS_IGNORADOS = ['workingLocation', 'outOfOffice', 'focusTime'];

function httpError(message, status) {
    const err = new Error(message);
    err.status = status;
    return err;
}

const b64url = (s) => Buffer.from(s).toString('base64url');

module.exports = function createGoogle({ env = process.env, fetchFn = fetch, ahora = () => Date.now() } = {}) {
    const configurado = () => !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
    const redirectUri = () => env.GOOGLE_REDIRECT_URI || 'http://localhost:3001/onix/google/callback';
    const exigirConfig = () => {
        if (!configurado()) throw httpError('La conexión con Google no está configurada en el servidor (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET)', 503);
    };
    const firma = (payload) => crypto.createHmac('sha256', env.GOOGLE_CLIENT_SECRET).update(payload).digest('base64url');

    // El callback llega sin token de Bravo Hub: el state firmado dice de quién es.
    function firmarEstado(userId) {
        const payload = `${userId}.${ahora() + ESTADO_VIGENCIA}`;
        return b64url(`${payload}.${firma(payload)}`);
    }

    function leerEstado(state) {
        try {
            const [userId, vence, sig] = Buffer.from(String(state || ''), 'base64url').toString().split('.');
            const esperado = Buffer.from(firma(`${userId}.${vence}`));
            const recibido = Buffer.from(sig || '');
            if (recibido.length !== esperado.length || !crypto.timingSafeEqual(recibido, esperado)) return null;
            if (Number(vence) < ahora()) return null;
            return Number(userId) || null;
        } catch {
            return null;
        }
    }

    function urlAutorizacion(userId) {
        exigirConfig();
        const q = new URLSearchParams({
            client_id: env.GOOGLE_CLIENT_ID,
            redirect_uri: redirectUri(),
            response_type: 'code',
            scope: SCOPES.join(' '),
            access_type: 'offline',
            prompt: 'consent',
            include_granted_scopes: 'true',
            state: firmarEstado(userId),
        });
        return `${AUTH_URL}?${q}`;
    }

    async function token(params) {
        let res;
        try {
            res = await fetchFn(TOKEN_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({ client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET, ...params }),
            });
        } catch {
            throw httpError('Google no respondió, intenta de nuevo', 503);
        }
        const data = await res.json().catch(() => ({}));
        if (data.error === 'invalid_grant') throw httpError('Tu conexión con Google venció o fue retirada. Vuelve a conectar tu cuenta en Configuración', 409);
        if (!res.ok) throw httpError(`Google rechazó la solicitud (${data.error || res.status})`, 503);
        return data;
    }

    async function canjearCodigo(code) {
        exigirConfig();
        const data = await token({ code, grant_type: 'authorization_code', redirect_uri: redirectUri() });
        if (!data.refresh_token) throw httpError('Google no entregó el permiso de acceso. Intenta conectar de nuevo', 503);
        if (!String(data.scope || '').includes('calendar.readonly')) throw httpError('No se dio permiso para leer el calendario. Conecta de nuevo y marca la casilla del calendario', 400);
        // El id_token viene directo de Google por HTTPS: basta con leer el correo.
        const claims = JSON.parse(Buffer.from(String(data.id_token || '').split('.')[1] || '', 'base64url').toString() || '{}');
        return { refreshToken: data.refresh_token, email: claims.email || '' };
    }

    // Eventos del rango [desde, hasta) del calendario principal, sin cancelados,
    // rechazados ni bloques de ubicación/ausencia.
    async function eventos(refreshToken, desde, hasta) {
        exigirConfig();
        const { access_token: accessToken } = await token({ refresh_token: refreshToken, grant_type: 'refresh_token' });
        const items = [];
        let pageToken;
        for (let i = 0; i < 5; i++) {
            const q = new URLSearchParams({ timeMin: desde, timeMax: hasta, singleEvents: 'true', orderBy: 'startTime', maxResults: '250' });
            if (pageToken) q.set('pageToken', pageToken);
            let res;
            try {
                res = await fetchFn(`${EVENTS_URL}?${q}`, { headers: { Authorization: `Bearer ${accessToken}` } });
            } catch {
                throw httpError('Google Calendar no respondió, intenta de nuevo', 503);
            }
            if (res.status === 403) throw httpError('Google Calendar no está habilitado o no hay permiso para leerlo', 503);
            if (!res.ok) throw httpError(`Google Calendar respondió con error ${res.status}`, 503);
            const data = await res.json();
            items.push(...(data.items || []));
            pageToken = data.nextPageToken;
            if (!pageToken) break;
        }
        return items
            .filter((e) => e.status !== 'cancelled' && !TIPOS_IGNORADOS.includes(e.eventType))
            .filter((e) => (e.attendees || []).find((a) => a.self)?.responseStatus !== 'declined')
            .map((e) => {
                const inicio = e.start?.dateTime || e.start?.date;
                const fin = e.end?.dateTime || e.end?.date;
                const todoElDia = !e.start?.dateTime;
                return {
                    id: e.id,
                    titulo: (e.summary || '(Sin título)').trim(),
                    inicio,
                    fin,
                    todoElDia,
                    duracionMin: todoElDia ? null : Math.round((new Date(fin) - new Date(inicio)) / 60000),
                    asistentes: (e.attendees || []).filter((a) => !a.resource).length,
                };
            });
    }

    async function revocar(refreshToken) {
        try {
            await fetchFn(`${REVOKE_URL}?token=${encodeURIComponent(refreshToken)}`, { method: 'POST' });
        } catch {
            // Si Google no responde igual se borra la conexión local.
        }
    }

    return { configurado, urlAutorizacion, leerEstado, canjearCodigo, eventos, revocar };
};
