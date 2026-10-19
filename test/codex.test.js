const test = require('node:test');
const assert = require('node:assert');
const createController = require('../api/codex/controller');

const no = (status) => (e) => e.status === status;

// BD falsa en memoria con lo mínimo que usa el controller.
function setup() {
    const st = { users: { 'ana@x.co': 1, 'beto@x.co': 2 }, paginas: {}, seq: 100 };
    const fila = (p) => ({ id: p.id, nombre: p.nombre, created_at: p.created_at, updated_at: p.updated_at });
    const db = {
        st,
        findPlatformUserByEmail: async (email) => (st.users[email] ? [{ id: st.users[email], email }] : []),
        codex: {
            listPaginas: async (uid) => Object.values(st.paginas).filter((p) => p.platform_user_id === uid).map(fila),
            getPagina: async (id) => st.paginas[id] || null,
            insertPagina: async (uid, nombre, json) => {
                const id = ++st.seq;
                const now = new Date();
                st.paginas[id] = { id, platform_user_id: uid, nombre, bloques: JSON.parse(json), created_at: now, updated_at: now };
                return fila(st.paginas[id]);
            },
            updatePagina: async (id, nombre, json) => {
                const p = st.paginas[id];
                if (nombre !== null) p.nombre = nombre;
                if (json !== null) p.bloques = JSON.parse(json);
                p.updated_at = new Date();
                return fila(p);
            },
            deletePagina: async (id) => { const p = st.paginas[id]; delete st.paginas[id]; return p ? { id: p.id, nombre: p.nombre } : null; },
        },
    };
    return { db, ctrl: createController(db) };
}

const BLOQUE = { id: 'b1', type: 'TEXT', content: { html: '<p>Hola</p>' }, style: {} };

test('getActor: usuario de Bravo Hub inexistente → 403', async () => {
    const { ctrl } = setup();
    await assert.rejects(ctrl.getActor('nadie@x.co'), no(403));
    assert.deepStrictEqual(await ctrl.getActor('ana@x.co'), { userId: 1, email: 'ana@x.co' });
});

test('createPagina recorta el nombre, arranca con bloques vacíos y aparece en la lista propia', async () => {
    const { ctrl } = setup();
    const ana = await ctrl.getActor('ana@x.co');
    const p = await ctrl.createPagina(ana, { nombre: '  Unidad 1  ' });
    assert.strictEqual(p.nombre, 'Unidad 1');
    assert.deepStrictEqual((await ctrl.getPagina(ana, p.id)).bloques, []);
    assert.deepStrictEqual((await ctrl.listPaginas(ana)).map((x) => x.id), [p.id]);
    const beto = await ctrl.getActor('beto@x.co');
    assert.deepStrictEqual(await ctrl.listPaginas(beto), []);
});

test('nombre vacío, solo espacios o de más de 150 caracteres → 400 (crear y renombrar)', async () => {
    const { ctrl } = setup();
    const ana = await ctrl.getActor('ana@x.co');
    await assert.rejects(ctrl.createPagina(ana, {}), no(400));
    await assert.rejects(ctrl.createPagina(ana, { nombre: '   ' }), no(400));
    await assert.rejects(ctrl.createPagina(ana, { nombre: 'x'.repeat(151) }), no(400));
    const p = await ctrl.createPagina(ana, { nombre: 'Ok' });
    await assert.rejects(ctrl.updatePagina(ana, p.id, { nombre: ' ' }), no(400));
    assert.strictEqual((await ctrl.getPagina(ana, p.id)).nombre, 'Ok');
});

test('bloques que no son lista → 400; JSON de más de 4 000 000 caracteres → 413', async () => {
    const { ctrl } = setup();
    const ana = await ctrl.getActor('ana@x.co');
    await assert.rejects(ctrl.createPagina(ana, { nombre: 'A', bloques: {} }), no(400));
    const p = await ctrl.createPagina(ana, { nombre: 'A' });
    await assert.rejects(ctrl.updatePagina(ana, p.id, { bloques: 'x' }), no(400));
    const grande = [{ ...BLOQUE, content: { html: 'x'.repeat(4_000_000) } }];
    await assert.rejects(ctrl.updatePagina(ana, p.id, { bloques: grande }), no(413));
    assert.deepStrictEqual((await ctrl.getPagina(ana, p.id)).bloques, []);
});

test('updatePagina guarda bloques y/o nombre; sin nada que guardar → 400', async () => {
    const { ctrl } = setup();
    const ana = await ctrl.getActor('ana@x.co');
    const p = await ctrl.createPagina(ana, { nombre: 'A' });
    await ctrl.updatePagina(ana, p.id, { bloques: [BLOQUE] });
    assert.deepStrictEqual((await ctrl.getPagina(ana, p.id)).bloques, [BLOQUE]);
    const r = await ctrl.updatePagina(ana, p.id, { nombre: 'B' });
    assert.strictEqual(r.nombre, 'B');
    assert.deepStrictEqual((await ctrl.getPagina(ana, p.id)).bloques, [BLOQUE]);
    await assert.rejects(ctrl.updatePagina(ana, p.id, {}), no(400));
});

test('página ajena, inexistente o id no numérico → 404 en abrir, guardar, duplicar y borrar', async () => {
    const { ctrl } = setup();
    const ana = await ctrl.getActor('ana@x.co');
    const beto = await ctrl.getActor('beto@x.co');
    const p = await ctrl.createPagina(ana, { nombre: 'De Ana' });
    await assert.rejects(ctrl.getPagina(beto, p.id), no(404));
    await assert.rejects(ctrl.updatePagina(beto, p.id, { bloques: [] }), no(404));
    await assert.rejects(ctrl.duplicarPagina(beto, p.id), no(404));
    await assert.rejects(ctrl.deletePagina(beto, p.id), no(404));
    await assert.rejects(ctrl.getPagina(ana, 9999), no(404));
    await assert.rejects(ctrl.getPagina(ana, 'abc'), no(404));
});

test('duplicarPagina copia bloques con nombre "(copia)" sin pasar de 150 caracteres', async () => {
    const { ctrl } = setup();
    const ana = await ctrl.getActor('ana@x.co');
    const p = await ctrl.createPagina(ana, { nombre: 'Unidad', bloques: [BLOQUE] });
    const c = await ctrl.duplicarPagina(ana, p.id);
    assert.notStrictEqual(c.id, p.id);
    assert.strictEqual(c.nombre, 'Unidad (copia)');
    assert.deepStrictEqual((await ctrl.getPagina(ana, c.id)).bloques, [BLOQUE]);
    const larga = await ctrl.createPagina(ana, { nombre: 'x'.repeat(150) });
    assert.strictEqual((await ctrl.duplicarPagina(ana, larga.id)).nombre.length, 150);
});

test('deletePagina borra y devuelve id y nombre', async () => {
    const { ctrl } = setup();
    const ana = await ctrl.getActor('ana@x.co');
    const p = await ctrl.createPagina(ana, { nombre: 'Borrar' });
    assert.deepStrictEqual(await ctrl.deletePagina(ana, p.id), { id: p.id, nombre: 'Borrar' });
    await assert.rejects(ctrl.getPagina(ana, p.id), no(404));
});
