const test = require('node:test');
const assert = require('node:assert');
const { setup, no } = require('./onixFakes');
const createGoogle = require('../services/onix/google');

const conectar = async (ctrl) => ctrl.googleCallback({ code: 'c1', state: 'valido-1' });

test('estado y url de conexión', async () => {
    const { ctrl } = setup();
    const ana = await ctrl.getActor('ana@x.co');
    assert.deepStrictEqual(await ctrl.googleEstado(ana), { configurado: true, conectado: false, email: null });
    assert.strictEqual((await ctrl.googleUrl(ana)).url, 'https://google/auth?state=1');
});

test('callback guarda el token cifrado; state inválido o error de Google → 400', async () => {
    const { ctrl, db } = setup();
    assert.deepStrictEqual(await conectar(ctrl), { userId: 1, email: 'ana@gmail.com' });
    assert.deepStrictEqual(db.st.google[1].refresh_token, { c: 'rt-1' });
    await assert.rejects(ctrl.googleCallback({ code: 'c', state: 'otro' }), no(400));
    await assert.rejects(ctrl.googleCallback({ error: 'access_denied' }), no(400));
    const ana = await ctrl.getActor('ana@x.co');
    assert.deepStrictEqual(await ctrl.googleEstado(ana), { configurado: true, conectado: true, email: 'ana@gmail.com' });
});

test('desconectar revoca y borra; sin conexión → 404', async () => {
    const { ctrl, db, googleCalls } = setup();
    await conectar(ctrl);
    const ana = await ctrl.getActor('ana@x.co');
    await ctrl.googleDesconectar(ana);
    assert.ok(!db.st.google[1]);
    assert.deepStrictEqual(googleCalls.at(-1), ['revocar', 'rt-1']);
    await assert.rejects(ctrl.googleDesconectar(ana), no(404));
});

test('eventos del mes en hora de Colombia; sin conexión → 409; los usados no se ofrecen', async () => {
    const { ctrl, googleCalls } = setup();
    const ana = await ctrl.getActor('ana@x.co');
    await assert.rejects(ctrl.listEventosGoogle(ana, { mes: '10', anio: '2027' }), no(409));
    await conectar(ctrl);
    const evs = await ctrl.listEventosGoogle(ana, { mes: '12', anio: '2027' });
    assert.strictEqual(evs.length, 2);
    assert.deepStrictEqual(googleCalls.at(-1), ['eventos', 'rt-1', '2027-12-01T00:00:00-05:00', '2028-01-01T00:00:00-05:00']);
    await ctrl.registroDesdeGoogle(ana, { actividad_id: '100', mes: '10', anio: '2027', evento_ids: ['ev1'] });
    assert.deepStrictEqual((await ctrl.listEventosGoogle(ana, { mes: '10', anio: '2027' })).map((e) => e.id), ['ev2']);
});

test('registroDesdeGoogle arma el texto en orden con duración y asistentes', async () => {
    const { ctrl, db } = setup();
    await conectar(ctrl);
    const ana = await ctrl.getActor('ana@x.co');
    const r = await ctrl.registroDesdeGoogle(ana, { actividad_id: '100', mes: '10', anio: '2027', evento_ids: ['ev1', 'ev2'] });
    assert.deepStrictEqual(r.desarrollo.split('\n'), [
        '- 01/10/2027: Capacitación Moodle',
        '- 04/10/2027: Reunión de área (1 h 30 min, 5 asistentes)',
    ]);
    assert.strictEqual(r.titulo, 'Reuniones y eventos del mes');
    assert.strictEqual(r.eventos, 2);
    assert.strictEqual(db.st.eventosUsados.ev1.registroId, r.id);
});

test('registroDesdeGoogle: evento inexistente → 404, vacío → 400, a existente agrega, repetido → 409', async () => {
    const { ctrl } = setup();
    await conectar(ctrl);
    const ana = await ctrl.getActor('ana@x.co');
    const base = { actividad_id: '100', mes: '10', anio: '2027' };
    await assert.rejects(ctrl.registroDesdeGoogle(ana, { ...base, evento_ids: ['nope'] }), no(404));
    await assert.rejects(ctrl.registroDesdeGoogle(ana, { ...base, evento_ids: [] }), no(400));
    const r = await ctrl.registroDesdeGoogle(ana, { ...base, evento_ids: ['ev2'], registro_id: '1000' });
    assert.strictEqual(r.id, 1000);
    assert.strictEqual(r.desarrollo, 'Atendí 30 tickets\n- 01/10/2027: Capacitación Moodle');
    await assert.rejects(ctrl.registroDesdeGoogle(ana, { ...base, evento_ids: ['ev2'] }), no(409));
});

// ── Servicio real con fetch falso ──
const ENV = { GOOGLE_CLIENT_ID: 'cid', GOOGLE_CLIENT_SECRET: 'sec', GOOGLE_REDIRECT_URI: 'http://api/cb' };

test('servicio: state firmado vence y no se puede falsificar', () => {
    let t = 1000;
    const g = createGoogle({ env: ENV, ahora: () => t });
    const url = new URL(g.urlAutorizacion(7));
    assert.strictEqual(url.searchParams.get('access_type'), 'offline');
    assert.match(url.searchParams.get('scope'), /calendar\.readonly/);
    const state = url.searchParams.get('state');
    assert.strictEqual(g.leerEstado(state), 7);
    const falso = Buffer.from(Buffer.from(state, 'base64url').toString().replace(/^7\./, '8.')).toString('base64url');
    assert.strictEqual(g.leerEstado(falso), null);
    t += 11 * 60 * 1000;
    assert.strictEqual(g.leerEstado(state), null);
});

test('servicio: sin credencial → 503', () => {
    assert.throws(() => createGoogle({ env: {} }).urlAutorizacion(1), (e) => e.status === 503);
});

test('servicio: eventos filtra cancelados, rechazados y ausencias; token vencido → 409', async () => {
    const items = [
        { id: 'a', summary: 'Reunión', status: 'confirmed', start: { dateTime: '2027-10-04T09:00:00-05:00' }, end: { dateTime: '2027-10-04T10:00:00-05:00' }, attendees: [{ self: true, responseStatus: 'accepted' }, { email: 'x' }, { resource: true }] },
        { id: 'b', summary: 'Cancelado', status: 'cancelled', start: { dateTime: '2027-10-05T09:00:00-05:00' }, end: { dateTime: '2027-10-05T10:00:00-05:00' } },
        { id: 'c', summary: 'Rechacé', start: { dateTime: '2027-10-06T09:00:00-05:00' }, end: { dateTime: '2027-10-06T10:00:00-05:00' }, attendees: [{ self: true, responseStatus: 'declined' }] },
        { id: 'd', summary: 'Casa', eventType: 'workingLocation', start: { date: '2027-10-07' }, end: { date: '2027-10-08' } },
        { id: 'e', start: { date: '2027-10-09' }, end: { date: '2027-10-10' } },
    ];
    const fetchFn = async (url) => (url.includes('/token')
        ? { ok: true, json: async () => ({ access_token: 'at' }) }
        : { ok: true, status: 200, json: async () => ({ items }) });
    const evs = await createGoogle({ env: ENV, fetchFn }).eventos('rt', 'd', 'h');
    assert.deepStrictEqual(evs, [
        { id: 'a', titulo: 'Reunión', inicio: '2027-10-04T09:00:00-05:00', fin: '2027-10-04T10:00:00-05:00', todoElDia: false, duracionMin: 60, asistentes: 2 },
        { id: 'e', titulo: '(Sin título)', inicio: '2027-10-09', fin: '2027-10-10', todoElDia: true, duracionMin: null, asistentes: 0 },
    ]);
    const vencido = async () => ({ ok: false, status: 400, json: async () => ({ error: 'invalid_grant' }) });
    await assert.rejects(createGoogle({ env: ENV, fetchFn: vencido }).eventos('rt', 'd', 'h'), (e) => e.status === 409);
});

test('servicio: canjearCodigo exige refresh_token y permiso de calendario; lee el correo del id_token', async () => {
    const idToken = `x.${Buffer.from(JSON.stringify({ email: 'ana@pascualbravo.edu.co' })).toString('base64url')}.y`;
    const resp = (data) => async () => ({ ok: true, json: async () => data });
    const ok = await createGoogle({ env: ENV, fetchFn: resp({ refresh_token: 'rt', scope: 'openid https://www.googleapis.com/auth/calendar.readonly', id_token: idToken }) }).canjearCodigo('c');
    assert.deepStrictEqual(ok, { refreshToken: 'rt', email: 'ana@pascualbravo.edu.co' });
    await assert.rejects(createGoogle({ env: ENV, fetchFn: resp({ refresh_token: 'rt', scope: 'openid', id_token: idToken }) }).canjearCodigo('c'), (e) => e.status === 400);
    await assert.rejects(createGoogle({ env: ENV, fetchFn: resp({ scope: 'calendar.readonly' }) }).canjearCodigo('c'), (e) => e.status === 503);
});

// ── Gmail (correos enviados) ──
test('correos del mes: rango en ms hora Colombia; sin conexión → 409; usados no se ofrecen y no chocan con eventos', async () => {
    const { ctrl, googleCalls } = setup();
    const ana = await ctrl.getActor('ana@x.co');
    await assert.rejects(ctrl.listCorreosGoogle(ana, { mes: '10', anio: '2027' }), no(409));
    await conectar(ctrl);
    assert.strictEqual((await ctrl.listCorreosGoogle(ana, { mes: '10', anio: '2027' })).length, 2);
    assert.deepStrictEqual(googleCalls.at(-1), ['correos', 'rt-1', Date.parse('2027-10-01T05:00:00Z'), Date.parse('2027-11-01T05:00:00Z')]);
    await ctrl.registroDesdeCorreo(ana, { actividad_id: '100', mes: '10', anio: '2027', correo_ids: ['h1'] });
    assert.deepStrictEqual((await ctrl.listCorreosGoogle(ana, { mes: '10', anio: '2027' })).map((c) => c.id), ['h2']);
    assert.strictEqual((await ctrl.listEventosGoogle(ana, { mes: '10', anio: '2027' })).length, 2);
});

test('registroDesdeCorreo arma el texto con destinatarios y cantidad; inexistente → 404, vacío → 400, repetido → 409', async () => {
    const { ctrl, db } = setup();
    await conectar(ctrl);
    const ana = await ctrl.getActor('ana@x.co');
    const base = { actividad_id: '100', mes: '10', anio: '2027' };
    await assert.rejects(ctrl.registroDesdeCorreo(ana, { ...base, correo_ids: ['nope'] }), no(404));
    await assert.rejects(ctrl.registroDesdeCorreo(ana, { ...base, correo_ids: [] }), no(400));
    const r = await ctrl.registroDesdeCorreo(ana, { ...base, correo_ids: ['h1', 'h2'] });
    assert.deepStrictEqual(r.desarrollo.split('\n'), [
        '- 02/10/2027: Correo "Cronograma de capacitación" (a Ana Pérez, bob@x.co, Carla y 1 más, 3 correos)',
        '- 06/10/2027: Correo "Solicitud de aulas" (a Soporte)',
    ]);
    assert.strictEqual(r.titulo, 'Gestión por correo electrónico');
    assert.strictEqual(r.correos, 2);
    assert.strictEqual(db.st.eventosUsados['gmail:h1'].registroId, r.id);
    await assert.rejects(ctrl.registroDesdeCorreo(ana, { ...base, correo_ids: ['h2'] }), no(409));
});

test('servicio: correosEnviados agrupa por conversación, filtra el mes y para al pasar el inicio', async () => {
    const msg = (id, threadId, fecha, subject, to) => ({ id, threadId, internalDate: String(Date.parse(fecha)), payload: { headers: [{ name: 'Subject', value: subject }, { name: 'To', value: to }] } });
    const mensajes = {
        m1: msg('m1', 't1', '2027-11-02T15:00:00Z', 'Fuera del mes', 'x@x.co'),
        m2: msg('m2', 't2', '2027-10-20T15:00:00Z', 'RE: Aulas', '"Pérez, Ana" <ana@x.co>'),
        m3: msg('m3', 't2', '2027-10-05T15:00:00Z', 'Aulas', 'Soporte <soporte@x.co>, bob@x.co'),
        m4: msg('m4', 't3', '2027-09-30T15:00:00Z', 'Mes anterior', 'y@x.co'),
    };
    const urls = [];
    const fetchFn = async (url) => {
        urls.push(url);
        if (url.includes('/token')) return { ok: true, json: async () => ({ access_token: 'at' }) };
        const id = url.match(/messages\/(\w+)\?/)?.[1];
        if (id) return { ok: true, status: 200, json: async () => mensajes[id] };
        // Primera página llega hasta un correo anterior al mes: no se pide la segunda.
        return { ok: true, status: 200, json: async () => ({ messages: [{ id: 'm1' }, { id: 'm2' }, { id: 'm3' }, { id: 'm4' }], nextPageToken: 'p2' }) };
    };
    const r = await createGoogle({ env: ENV, fetchFn }).correosEnviados('rt', Date.parse('2027-10-01T05:00:00Z'), Date.parse('2027-11-01T05:00:00Z'));
    assert.deepStrictEqual(r, [{ id: 't2', asunto: 'Aulas', para: ['Pérez, Ana', 'Soporte', 'bob@x.co'], mensajes: 2, fecha: '2027-10-05T15:00:00.000Z' }]);
    assert.ok(!urls.some((u) => u.includes('pageToken')));
    assert.ok(urls.every((u) => !u.includes('format=full')));
});

test('servicio: correos sin permiso de Gmail → 409 (reconectar); API deshabilitada → 503', async () => {
    const con = (error) => async (url) => (url.includes('/token')
        ? { ok: true, json: async () => ({ access_token: 'at' }) }
        : { ok: false, status: 403, json: async () => ({ error }) });
    await assert.rejects(createGoogle({ env: ENV, fetchFn: con({ message: 'Request had insufficient authentication scopes.' }) }).correosEnviados('rt', 0, 1), (e) => e.status === 409);
    await assert.rejects(createGoogle({ env: ENV, fetchFn: con({ message: 'Gmail API has not been used in project' }) }).correosEnviados('rt', 0, 1), (e) => e.status === 503);
});
