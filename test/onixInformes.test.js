const test = require('node:test');
const assert = require('node:assert');
const { setup, no } = require('./onixFakes');

test('generarInforme arma el prompt en el backend con los registros y guarda proveedor/modelo', async () => {
    const { ctrl, iaCalls, db } = setup();
    const ana = await ctrl.getActor('ana@x.co');
    const inf = await ctrl.generarInforme(ana, { actividad_id: '100', mes: '10', anio: '2027' });
    assert.strictEqual(inf.desarrollo, 'Párrafo IA');
    assert.strictEqual(inf.proveedor, 'ollama');
    assert.strictEqual(inf.modelo, 'qwen2.5:7b');
    assert.strictEqual(inf.actividad_nombre, 'Soporte');
    assert.match(iaCalls[0].prompt, /Octubre de 2027/);
    assert.match(iaCalls[0].prompt, /- Atendí 30 tickets/);
    assert.match(iaCalls[0].prompt, /Actividad: Soporte/);
    assert.match(iaCalls[0].system, /español colombiano/);
    assert.strictEqual(Object.values(db.st.informes).length, 1);
});

test('generar dos veces el mismo mes reemplaza el informe (upsert), no duplica', async () => {
    const { ctrl, db } = setup();
    const ana = await ctrl.getActor('ana@x.co');
    await ctrl.generarInforme(ana, { actividad_id: '100', mes: '10', anio: '2027' });
    await ctrl.generarInforme(ana, { actividad_id: '100', mes: '10', anio: '2027' });
    assert.strictEqual(Object.values(db.st.informes).length, 1);
});

test('generarInforme sin registros del mes → 400 con nombre y mes', async () => {
    const { ctrl, iaCalls } = setup();
    const ana = await ctrl.getActor('ana@x.co');
    await assert.rejects(ctrl.generarInforme(ana, { actividad_id: '100', mes: '9', anio: '2027' }),
        (e) => e.status === 400 && e.message.includes('Soporte') && e.message.includes('Septiembre de 2027'));
    assert.strictEqual(iaCalls.length, 0);
});

test('generarInforme sin perfil → 400 antes de llamar a la IA', async () => {
    const { ctrl, db, iaCalls } = setup();
    delete db.st.perfiles[1];
    const ana = await ctrl.getActor('ana@x.co');
    await assert.rejects(ctrl.generarInforme(ana, { actividad_id: '100', mes: '10', anio: '2027' }),
        (e) => e.status === 400 && e.message.includes('perfil'));
    assert.strictEqual(iaCalls.length, 0);
});

test('generarInforme de actividad ajena → 404 (ni el admin genera por otro)', async () => {
    const { ctrl } = setup();
    const admin = await ctrl.getActor('admin@x.co');
    await assert.rejects(ctrl.generarInforme(admin, { actividad_id: '100', mes: '10', anio: '2027' }), no(404));
});

test('si la IA falla, el error sube con su status y el informe anterior se conserva', async () => {
    const { ctrl, db, ia } = setup();
    const ana = await ctrl.getActor('ana@x.co');
    await ctrl.generarInforme(ana, { actividad_id: '100', mes: '10', anio: '2027' });
    ia.generarTexto = async () => { const e = new Error('La IA no respondió'); e.status = 503; throw e; };
    await assert.rejects(ctrl.generarInforme(ana, { actividad_id: '100', mes: '10', anio: '2027' }), no(503));
    assert.strictEqual(Object.values(db.st.informes)[0].desarrollo, 'Párrafo IA');
});

test('updateInforme: solo el dueño; texto vacío → 400', async () => {
    const { ctrl } = setup();
    const ana = await ctrl.getActor('ana@x.co');
    const coord = await ctrl.getActor('coord@x.co');
    const inf = await ctrl.generarInforme(ana, { actividad_id: '100', mes: '10', anio: '2027' });
    await assert.rejects(ctrl.updateInforme(coord, String(inf.id), { desarrollo: 'X' }), no(404));
    await assert.rejects(ctrl.updateInforme(ana, String(inf.id), { desarrollo: '  ' }), no(400));
    const editado = await ctrl.updateInforme(ana, String(inf.id), { desarrollo: 'Texto corregido' });
    assert.strictEqual(editado.desarrollo, 'Texto corregido');
    assert.strictEqual(editado.actividad_nombre, 'Soporte');
});

test('listInformes propio y de un usuario de mi área; de otra área → 404', async () => {
    const { ctrl } = setup();
    const ana = await ctrl.getActor('ana@x.co');
    const coord = await ctrl.getActor('coord@x.co');
    await ctrl.generarInforme(ana, { actividad_id: '100', mes: '10', anio: '2027' });
    assert.strictEqual((await ctrl.listInformes(ana, { mes: '10', anio: '2027' })).length, 1);
    assert.strictEqual((await ctrl.listInformes(coord, { mes: '10', anio: '2027', user_id: '1' })).length, 1);
    await assert.rejects(ctrl.listInformes(coord, { mes: '10', anio: '2027', user_id: '2' }), no(404));
});

test('informeWord usa número de actividad, perfil y nombre de archivo; coordinador del área puede descargar', async () => {
    const { ctrl, wordCalls } = setup();
    const ana = await ctrl.getActor('ana@x.co');
    const coord = await ctrl.getActor('coord@x.co');
    const beto = await ctrl.getActor('beto@x.co');
    const inf = await ctrl.generarInforme(ana, { actividad_id: '100', mes: '10', anio: '2027' });
    const r = await ctrl.informeWord(coord, String(inf.id));
    assert.strictEqual(r.filename, 'Informe_Actividad_1_Octubre_2027.docx');
    const args = wordCalls[0][1];
    assert.strictEqual(args.numero, 1);
    assert.strictEqual(args.perfil.identificacion, '1001');
    assert.strictEqual(args.evidencias.length, 2);
    await assert.rejects(ctrl.informeWord(beto, String(inf.id)), no(404));
});

test('evidenciasWord lee imágenes del storage; sin evidencias → 400', async () => {
    const { ctrl, wordCalls } = setup();
    const ana = await ctrl.getActor('ana@x.co');
    const r = await ctrl.evidenciasWord(ana, '100', { mes: '10', anio: '2027' });
    assert.strictEqual(r.filename, 'Evidencias_Actividad_1_Octubre_2027.docx');
    const img = wordCalls[0][1].evidencias.find((e) => e.tipo === 'imagen');
    assert.strictEqual(img.imagen.toString(), 'img');
    assert.strictEqual(img.ext, 'png');
    await assert.rejects(ctrl.evidenciasWord(ana, '100', { mes: '9', anio: '2027' }), no(400));
});

test('evidenciasWord: imagen ilegible no rompe el documento (imagen null)', async () => {
    const { ctrl, storage, wordCalls } = setup();
    storage.leer = async () => { throw new Error('ENOENT'); };
    const ana = await ctrl.getActor('ana@x.co');
    await ctrl.evidenciasWord(ana, '100', { mes: '10', anio: '2027' });
    assert.strictEqual(wordCalls[0][1].evidencias.find((e) => e.tipo === 'imagen').imagen, null);
});

test('el prompt aplica las reglas de redacción institucionales', async () => {
    const { ctrl, iaCalls } = setup();
    const ana = await ctrl.getActor('ana@x.co');
    await ctrl.generarInforme(ana, { actividad_id: '100', mes: '10', anio: '2027' });
    const { system } = iaCalls[0];
    assert.match(system, /tercera persona/);
    assert.match(system, /mínimo 35 palabras/);
    assert.match(system, /SICAU/);
    assert.match(system, /Sistema de Gestión Académica/);
    assert.match(system, /una sola línea/);
    assert.match(system, /sin saludos/);
});

test('la respuesta de la IA se limpia: sin saltos de línea ni bloques de código', async () => {
    const { ctrl, ia } = setup();
    ia.generarTexto = async () => ({ texto: '```\nEl contratista realizó\n\n  la revisión.\r\n```', proveedor: 'ollama', modelo: 'qwen2.5:7b' });
    const ana = await ctrl.getActor('ana@x.co');
    const inf = await ctrl.generarInforme(ana, { actividad_id: '100', mes: '10', anio: '2027' });
    assert.strictEqual(inf.desarrollo, 'El contratista realizó la revisión.');
});
