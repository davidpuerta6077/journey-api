const test = require('node:test');
const assert = require('node:assert');
const { leerEnvEfectivo, verConfig, guardarConfig } = require('../services/onix/googleConfig');

const ENV = { IA_SECRET_KEY: 'clave-maestra-de-prueba' };
const CID = '123-abc.apps.googleusercontent.com';

function fakeDB() {
    const st = new Map();
    return {
        st,
        getSettings: async (cat) => (cat === 'google' ? [...st].map(([clave, valor]) => ({ categoria: 'google', clave, valor })) : []),
        upsertSetting: async (cat, clave, valor) => { assert.strictEqual(cat, 'google'); st.set(clave, valor); },
        deleteSetting: async (cat, clave) => { st.delete(clave); },
    };
}

test('sin nada en BD se usa el .env', async () => {
    const env = { GOOGLE_CLIENT_ID: 'e-id', GOOGLE_CLIENT_SECRET: 'e-sec', GOOGLE_REDIRECT_URI: 'http://a/onix/google/callback', FRONT_URL: 'http://f' };
    assert.deepStrictEqual(await leerEnvEfectivo({ db: fakeDB(), env }), env);
    assert.deepStrictEqual((await verConfig({ db: fakeDB(), env })).secreto, { configurado: true, origen: 'servidor', ultimos: '-sec' });
});

test('guardarConfig cifra el secreto, la vista nunca lo devuelve y la BD manda sobre el .env', async () => {
    const db = fakeDB();
    const r = await guardarConfig({ db, env: ENV, body: { client_id: ` ${CID} `, client_secret: ' GOCSPX-abcd9876 ', redirect_uri: 'https://api.x/onix/google/callback', front_url: 'https://hub.x' } });
    assert.deepStrictEqual(r, { secretoCambiado: true, secretoQuitado: false });
    assert.ok(!JSON.stringify(db.st.get('client_secret')).includes('GOCSPX'));
    const vista = await verConfig({ db, env: { ...ENV, GOOGLE_CLIENT_ID: 'otro' } });
    assert.ok(!JSON.stringify(vista).includes('GOCSPX'));
    assert.deepStrictEqual(vista, { client_id: CID, redirect_uri: 'https://api.x/onix/google/callback', front_url: 'https://hub.x', secreto: { configurado: true, origen: 'hub', ultimos: '9876' } });
    assert.deepStrictEqual(await leerEnvEfectivo({ db, env: { ...ENV, GOOGLE_CLIENT_SECRET: 'env' } }), {
        GOOGLE_CLIENT_ID: CID, GOOGLE_CLIENT_SECRET: 'GOCSPX-abcd9876', GOOGLE_REDIRECT_URI: 'https://api.x/onix/google/callback', FRONT_URL: 'https://hub.x',
    });
});

test('secreto vacío no cambia el guardado; quitar_secreto lo borra', async () => {
    const db = fakeDB();
    await guardarConfig({ db, env: ENV, body: { client_id: CID, client_secret: 'GOCSPX-1' } });
    assert.strictEqual((await guardarConfig({ db, env: ENV, body: { client_id: CID, client_secret: '' } })).secretoCambiado, false);
    assert.ok(db.st.has('client_secret'));
    assert.strictEqual((await guardarConfig({ db, env: ENV, body: { client_id: CID, quitar_secreto: true } })).secretoQuitado, true);
    assert.ok(!db.st.has('client_secret'));
});

test('guardarConfig valida id de cliente y URLs', async () => {
    const db = fakeDB();
    const no400 = (e) => e.status === 400;
    await assert.rejects(guardarConfig({ db, env: ENV, body: { client_id: 'abc' } }), no400);
    await assert.rejects(guardarConfig({ db, env: ENV, body: { client_id: CID, redirect_uri: 'ftp://x/onix/google/callback' } }), no400);
    await assert.rejects(guardarConfig({ db, env: ENV, body: { client_id: CID, redirect_uri: 'https://x/otra' } }), no400);
    await assert.rejects(guardarConfig({ db, env: ENV, body: { client_id: CID, front_url: 'hub' } }), no400);
    assert.strictEqual(db.st.size, 0);
});
