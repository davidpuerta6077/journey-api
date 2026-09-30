const test = require('node:test');
const assert = require('node:assert');
const createMoodleAccount = require('../services/moodleAccount');

const fakeRequest = (reply) => {
    const calls = [];
    const fn = async (...args) => { calls.push(args); return typeof reply === 'function' ? reply() : reply; };
    return { fn, calls };
};

test('getStatus envía el documento como identifier con el token del plugin', async () => {
    const { fn, calls } = fakeRequest({ locked: true, canunlock: true });
    const result = await createMoodleAccount(fn, 'tok').getStatus('1001');
    assert.deepStrictEqual(result, { locked: true, canunlock: true });
    assert.deepStrictEqual(calls[0], ['local_nexo_get_user_status', { identifier: '1001' }, 15000, 'tok']);
});

test('unlock y resetMfa envían el actor', async () => {
    const { fn, calls } = fakeRequest({ success: true });
    const svc = createMoodleAccount(fn, 'tok');
    await svc.unlock('1001', 'admin@x.co');
    await svc.resetMfa('1001', 'admin@x.co');
    assert.deepStrictEqual(calls[0].slice(0, 2), ['local_nexo_unlock_user', { identifier: '1001', actor: 'admin@x.co' }]);
    assert.deepStrictEqual(calls[1].slice(0, 2), ['local_nexo_reset_mfa', { identifier: '1001', actor: 'admin@x.co' }]);
});

test('Moodle sin respuesta → 502', async () => {
    const { fn } = fakeRequest(null);
    await assert.rejects(createMoodleAccount(fn, 'tok').unlock('1001', 'a'), (e) => e.statusCode === 502);
});

test('usuario inexistente en Moodle → 404 con el mensaje del plugin', async () => {
    const { fn } = fakeRequest({ exception: 'moodle_exception', errorcode: 'usernotfound', message: 'No existe un usuario de Moodle con el identificador "1001".' });
    await assert.rejects(createMoodleAccount(fn, 'tok').getStatus('1001'),
        (e) => e.statusCode === 404 && e.message.includes('1001'));
});

test('usuario protegido → 409', async () => {
    const { fn } = fakeRequest({ exception: 'moodle_exception', errorcode: 'userprotected', message: 'Protegido' });
    await assert.rejects(createMoodleAccount(fn, 'tok').unlock('1001', 'a'), (e) => e.statusCode === 409 && e.message === 'Protegido');
});

test('respuesta no JSON de Moodle (HTML de mantenimiento, proxy) → 502', async () => {
    const { fn } = fakeRequest('<html>Sitio en mantenimiento</html>');
    await assert.rejects(createMoodleAccount(fn, 'tok').getStatus('1001'), (e) => e.statusCode === 502);
});

test('plugin no instalado o token sin acceso → 502 con aviso', async () => {
    const { fn } = fakeRequest({ exception: 'webservice_access_exception', errorcode: 'accessexception', message: 'Access control exception' });
    await assert.rejects(createMoodleAccount(fn, 'tok').getStatus('1001'),
        (e) => e.statusCode === 502 && e.message.includes('plugin Nexo'));
});
