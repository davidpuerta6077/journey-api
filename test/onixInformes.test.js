const test = require('node:test');
const assert = require('node:assert');
const { setup, no } = require('./onixFakes');

const conIA = (ia, obj) => { ia.generarTexto = async () => ({ texto: typeof obj === 'string' ? obj : JSON.stringify(obj), proveedor: 'claude', modelo: 'm' }); };

test('generarSubactividad arma el prompt con notas, imágenes con su pie y enlaces, y guarda el resultado', async () => {
    const { ctrl, iaCalls, db } = setup();
    db.st.registros[1000].titulo = 'Mesa de ayuda';
    const ana = await ctrl.getActor('ana@x.co');
    const r = await ctrl.generarSubactividad(ana, '1000');
    const { prompt, system } = iaCalls[0];
    assert.match(prompt, /Octubre de 2027/);
    assert.match(prompt, /Actividad contractual: Soporte/);
    assert.match(prompt, /Título de la subactividad: Mesa de ayuda/);
    assert.match(prompt, /Atendí 30 tickets/);
    assert.match(prompt, /1\. Captura/);
    assert.match(prompt, /https:\/\/x\.co/);
    assert.match(system, /Durante este periodo se/);
    assert.match(system, /JSON/);
    assert.strictEqual(r.parrafo, 'Durante este periodo se atendieron los tickets de soporte de la plataforma.');
    assert.strictEqual(r.documento.titulo, 'Informe — Soporte');
    assert.deepStrictEqual(r.documento.secciones[0].imagenes, [5000]);
    assert.strictEqual(r.proveedor, 'ollama');
    assert.strictEqual(db.st.registros[1000].parrafo, r.parrafo);
});

test('el system prompt aplica las reglas institucionales', async () => {
    const { ctrl, iaCalls } = setup();
    await ctrl.generarSubactividad(await ctrl.getActor('ana@x.co'), '1000');
    const { system } = iaCalls[0];
    for (const re of [/tercera persona/, /mínimo 35 palabras/, /SICAU/, /Sistema de Gestión Académica/, /español colombiano/]) assert.match(system, re);
});

test('acepta JSON envuelto en ```json o con texto alrededor; el párrafo queda en una línea', async () => {
    const { ctrl, ia } = setup();
    conIA(ia, 'Claro, aquí está:\n```json\n{"parrafo": "Durante este periodo se\\n\\nhizo A.", "secciones": [{"titulo": "A", "texto": "Texto A", "imagenes": []}]}\n```');
    const r = await ctrl.generarSubactividad(await ctrl.getActor('ana@x.co'), '1000');
    assert.strictEqual(r.parrafo, 'Durante este periodo se hizo A.');
    assert.strictEqual(r.documento.titulo, null);
});

test('respuesta sin JSON válido, sin párrafo o sin secciones → 502 y no guarda nada', async () => {
    const { ctrl, ia, db } = setup();
    const ana = await ctrl.getActor('ana@x.co');
    for (const resp of ['Párrafo suelto', '{"parrafo": "x"', { parrafo: '', secciones: [{ texto: 'a' }] }, { parrafo: 'Durante', secciones: [] }]) {
        conIA(ia, resp);
        await assert.rejects(ctrl.generarSubactividad(ana, '1000'), no(502));
    }
    assert.strictEqual(db.st.registros[1000].parrafo, undefined);
});

test('índices de imagen inválidos o repetidos se ignoran', async () => {
    const { ctrl, ia } = setup();
    conIA(ia, { parrafo: 'Durante este periodo se hizo A.', secciones: [{ titulo: 'A', texto: 'a', imagenes: [1, 9, 'x'] }, { titulo: 'B', texto: 'b', imagenes: [1, 0] }] });
    const r = await ctrl.generarSubactividad(await ctrl.getActor('ana@x.co'), '1000');
    assert.deepStrictEqual(r.documento.secciones.map((s) => s.imagenes), [[5000], []]);
});

test('generarSubactividad: ajena → 404 (ni el admin); sin perfil → 400 sin llamar a la IA; error de IA sube', async () => {
    const { ctrl, db, ia, iaCalls } = setup();
    await assert.rejects(ctrl.generarSubactividad(await ctrl.getActor('admin@x.co'), '1000'), no(404));
    delete db.st.perfiles[1];
    await assert.rejects(ctrl.generarSubactividad(await ctrl.getActor('ana@x.co'), '1000'), (e) => e.status === 400 && e.message.includes('perfil'));
    assert.strictEqual(iaCalls.length, 0);
    db.st.perfiles[1] = { user_id: 1, nombre: 'Ana', identificacion: '1001', area_id: 10 };
    ia.generarTexto = async () => { const e = new Error('La IA no respondió'); e.status = 503; throw e; };
    await assert.rejects(ctrl.generarSubactividad(await ctrl.getActor('ana@x.co'), '1000'), no(503));
});

test('subactividadWord: sin generar → 400; generada → Word con imágenes leídas; coordinador puede, otra área no', async () => {
    const { ctrl, db, wordCalls } = setup();
    db.st.registros[1000].titulo = 'Mesa de ayuda: octubre';
    const ana = await ctrl.getActor('ana@x.co');
    await assert.rejects(ctrl.subactividadWord(ana, '1000'), (e) => e.status === 400 && e.message.includes('Mesa de ayuda'));
    await ctrl.generarSubactividad(ana, '1000');
    const r = await ctrl.subactividadWord(await ctrl.getActor('coord@x.co'), '1000');
    assert.strictEqual(r.filename, 'Mesa de ayuda octubre.docx');
    const args = wordCalls[0][1];
    assert.strictEqual(args.evidencias.length, 2);
    assert.strictEqual(args.imagenes.get(5000).ext, 'png');
    await assert.rejects(ctrl.subactividadWord(await ctrl.getActor('beto@x.co'), '1000'), no(404));
});

test('subactividadWord: imagen ilegible queda en null', async () => {
    const { ctrl, storage, wordCalls } = setup();
    const ana = await ctrl.getActor('ana@x.co');
    await ctrl.generarSubactividad(ana, '1000');
    storage.leer = async () => { throw new Error('ENOENT'); };
    await ctrl.subactividadWord(ana, '1000');
    assert.strictEqual(wordCalls[0][1].imagenes.get(5000), null);
});

test('documentoActividadWord: sin subactividades → 400; con pendientes → 400 nombrándolas; generado → nombre de Drive', async () => {
    const { ctrl, db, wordCalls } = setup();
    db.st.registros[1000].titulo = 'Mesa de ayuda';
    const ana = await ctrl.getActor('ana@x.co');
    await assert.rejects(ctrl.documentoActividadWord(ana, '100', { mes: '9', anio: '2027' }), no(400));
    await assert.rejects(ctrl.documentoActividadWord(ana, '100', { mes: '10', anio: '2027' }),
        (e) => e.status === 400 && e.message.includes('"Mesa de ayuda"'));
    await ctrl.generarSubactividad(ana, '1000');
    const r = await ctrl.documentoActividadWord(ana, '100', { mes: '10', anio: '2027' });
    assert.strictEqual(r.filename, 'Evidencia_Octubre_actividad_1.docx');
    const args = wordCalls[0][1];
    assert.strictEqual(args.numero, 1);
    assert.strictEqual(args.perfil.identificacion, '1001');
    assert.strictEqual(args.registros.length, 1);
});

test('zipMes arma la estructura de Drive, desambigua títulos repetidos y respeta el acceso', async () => {
    const JSZip = require('jszip');
    const { ctrl, db } = setup();
    db.st.actividades[101] = { id: 101, user_id: 1, nombre: 'Sin nada', descripcion: 'D', orden: 1 };
    db.st.actividades[102] = { id: 102, user_id: 1, nombre: 'Desarrollo', descripcion: 'D', orden: 2 };
    db.st.registros[1000].titulo = 'Mesa de ayuda';
    db.st.registros[1001] = { id: 1001, actividad_id: 102, user_id: 1, mes: 10, anio: 2027, titulo: 'CELEP', desarrollo: 'x' };
    db.st.registros[1002] = { id: 1002, actividad_id: 102, user_id: 1, mes: 10, anio: 2027, titulo: 'celep', desarrollo: 'y' };
    const ana = await ctrl.getActor('ana@x.co');
    await assert.rejects(ctrl.zipMes(ana, { mes: '10', anio: '2027' }), (e) => e.status === 400 && e.message.includes('CELEP'));
    for (const id of ['1000', '1001', '1002']) await ctrl.generarSubactividad(ana, id);
    const r = await ctrl.zipMes(await ctrl.getActor('coord@x.co'), { mes: '10', anio: '2027', user_id: '1' });
    assert.strictEqual(r.filename, 'Informe_Octubre_2027.zip');
    const archivos = Object.keys((await JSZip.loadAsync(r.buffer)).files).filter((f) => !f.endsWith('/')).sort();
    assert.deepStrictEqual(archivos, [
        '10_OCTUBRE/Actividad 1/Evidencia_Octubre_actividad_1.docx',
        '10_OCTUBRE/Actividad 1/Mesa de ayuda.docx',
        '10_OCTUBRE/Actividad 3/CELEP.docx',
        '10_OCTUBRE/Actividad 3/Evidencia_Octubre_actividad_3.docx',
        '10_OCTUBRE/Actividad 3/celep (2).docx',
    ]);
    await assert.rejects(ctrl.zipMes(await ctrl.getActor('otra@x.co'), { mes: '10', anio: '2027', user_id: '1' }), no(404));
    await assert.rejects(ctrl.zipMes(ana, { mes: '9', anio: '2027' }), no(400));
});
