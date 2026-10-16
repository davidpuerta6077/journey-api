const test = require('node:test');
const assert = require('node:assert');
const { setup, no } = require('./onixFakes');

test('getActor: usuario de Bravo Hub inexistente → 403', async () => {
    const { ctrl } = setup();
    await assert.rejects(ctrl.getActor('nadie@x.co'), no(403));
});

test('getActor arma permisos y área desde el perfil', async () => {
    const { ctrl } = setup();
    assert.deepStrictEqual(await ctrl.getActor('coord@x.co'), { userId: 3, email: 'coord@x.co', canArea: true, canAdmin: false, areaId: 10 });
    assert.deepStrictEqual(await ctrl.getActor('admin@x.co'), { userId: 4, email: 'admin@x.co', canArea: false, canAdmin: true, areaId: null });
});

test('savePerfil exige nombre e identificación y valida el área', async () => {
    const { ctrl, db } = setup();
    const ana = await ctrl.getActor('ana@x.co');
    await assert.rejects(ctrl.savePerfil(ana, { nombre: ' ', identificacion: '1' }), no(400));
    await assert.rejects(ctrl.savePerfil(ana, { nombre: 'Ana', identificacion: '1', area_id: 999 }), no(400));
    const p = await ctrl.savePerfil(ana, { nombre: ' Ana María ', identificacion: '1001', area_id: '20', contrato: 'VAD 1', objeto: '' });
    assert.deepStrictEqual(p, { user_id: 1, nombre: 'Ana María', identificacion: '1001', area_id: 20, contrato: 'VAD 1', objeto: null });
    assert.strictEqual(db.st.perfiles[1].area_id, 20);
});

test('createArea valida color y traduce nombre duplicado a 409', async () => {
    const { ctrl, db } = setup();
    assert.strictEqual((await ctrl.createArea({ nombre: 'Com' })).color, '#19445e');
    await assert.rejects(ctrl.createArea({ nombre: 'X', color: 'rojo' }), no(400));
    db.onix.insertArea = async () => { const e = new Error('dup'); e.code = '23505'; throw e; };
    await assert.rejects(ctrl.createArea({ nombre: 'Tec' }), no(409));
});

test('updateArea/deleteArea de un área inexistente → 404', async () => {
    const { ctrl } = setup();
    await assert.rejects(ctrl.updateArea(999, { nombre: 'X' }), no(404));
    await assert.rejects(ctrl.deleteArea(999), no(404));
});

test('listActividades: propio sin user_id; ajeno sin permiso → 404; id no numérico → 404', async () => {
    const { ctrl } = setup();
    const ana = await ctrl.getActor('ana@x.co');
    assert.deepStrictEqual((await ctrl.listActividades(ana)).map((a) => a.id), [100]);
    await assert.rejects(ctrl.listActividades(ana, '2'), no(404));
    await assert.rejects(ctrl.listActividades(ana, 'abc'), no(404));
});

test('coordinador ve actividades de su área, no de otra área', async () => {
    const { ctrl } = setup();
    const coord = await ctrl.getActor('coord@x.co');
    assert.deepStrictEqual((await ctrl.listActividades(coord, '1')).map((a) => a.id), [100]);
    await assert.rejects(ctrl.listActividades(coord, '2'), no(404));
});

test('coordinador sin área en su perfil no ve a nadie', async () => {
    const { ctrl } = setup();
    const otra = await ctrl.getActor('otra@x.co');
    assert.strictEqual(otra.areaId, null);
    await assert.rejects(ctrl.listActividades(otra, '1'), no(404));
    assert.deepStrictEqual(await ctrl.listUsuariosArea(otra, { mes: '10', anio: '2027' }), []);
});

test('admin ve todo pero no puede editar lo ajeno', async () => {
    const { ctrl } = setup();
    const admin = await ctrl.getActor('admin@x.co');
    assert.deepStrictEqual((await ctrl.listActividades(admin, '2')).map((a) => a.id), [200]);
    await assert.rejects(ctrl.updateActividad(admin, '200', { nombre: 'X', descripcion: 'Y' }), no(404));
    await assert.rejects(ctrl.deleteActividad(admin, '200'), no(404));
    assert.strictEqual((await ctrl.listUsuariosArea(admin, { mes: '10', anio: '2027' })).length, 3);
});

test('listUsuariosArea sin permiso de área ni admin → 403', async () => {
    const { ctrl } = setup();
    const ana = await ctrl.getActor('ana@x.co');
    await assert.rejects(ctrl.listUsuariosArea(ana, { mes: '10', anio: '2027' }), no(403));
});

test('createActividad exige nombre y descripción; deleteActividad borra sus imágenes', async () => {
    const { ctrl, storage } = setup();
    const ana = await ctrl.getActor('ana@x.co');
    await assert.rejects(ctrl.createActividad(ana, { nombre: 'X' }), no(400));
    const nueva = await ctrl.createActividad(ana, { nombre: 'Doc', descripcion: 'Documentar', orden: '2' });
    assert.strictEqual(nueva.orden, 2);
    const borrada = await ctrl.deleteActividad(ana, '100');
    assert.strictEqual(borrada.nombre, 'Soporte');
    assert.deepStrictEqual(storage.borrados, ['1/a.png']);
});

test('registros: valida mes/año, devuelve evidencias y solo el dueño escribe', async () => {
    const { ctrl } = setup();
    const ana = await ctrl.getActor('ana@x.co');
    const beto = await ctrl.getActor('beto@x.co');
    await assert.rejects(ctrl.listRegistros(ana, { actividad_id: '100', mes: '13', anio: '2027' }), no(400));
    await assert.rejects(ctrl.listRegistros(ana, { actividad_id: '100', mes: '10', anio: 'x' }), no(400));
    const regs = await ctrl.listRegistros(ana, { actividad_id: '100', mes: '10', anio: '2027' });
    assert.strictEqual(regs.length, 1);
    assert.strictEqual(regs[0].evidencias.length, 2);
    await assert.rejects(ctrl.listRegistros(beto, { actividad_id: '100', mes: '10', anio: '2027' }), no(404));
    await assert.rejects(ctrl.createRegistro(beto, { actividad_id: '100', mes: 10, anio: 2027, titulo: 'T', desarrollo: 'x' }), no(404));
    await assert.rejects(ctrl.updateRegistro(beto, '1000', { desarrollo: 'x' }), no(404));
    const nuevo = await ctrl.createRegistro(ana, { actividad_id: '100', mes: '11', anio: '2027', titulo: ' Capacitación ', desarrollo: ' Hice B ' });
    assert.strictEqual(nuevo.desarrollo, 'Hice B');
    assert.strictEqual(nuevo.titulo, 'Capacitación');
    assert.strictEqual(nuevo.mes, 11);
});

test('createRegistro sin título → 400; título > 200 → 400', async () => {
    const { ctrl } = setup();
    const ana = await ctrl.getActor('ana@x.co');
    await assert.rejects(ctrl.createRegistro(ana, { actividad_id: '100', mes: 10, anio: 2027, desarrollo: 'x' }), no(400));
    await assert.rejects(ctrl.createRegistro(ana, { actividad_id: '100', mes: 10, anio: 2027, titulo: 'a'.repeat(201), desarrollo: 'x' }), no(400));
});

test('updateRegistro: título y párrafo opcionales (no se borran si no vienen); vacíos → 400', async () => {
    const { ctrl, db } = setup();
    const ana = await ctrl.getActor('ana@x.co');
    Object.assign(db.st.registros[1000], { titulo: 'Viejo', parrafo: 'Durante este periodo se hizo A.' });
    let r = await ctrl.updateRegistro(ana, '1000', { desarrollo: 'Nuevo texto' });
    assert.strictEqual(r.titulo, 'Viejo');
    assert.strictEqual(r.parrafo, 'Durante este periodo se hizo A.');
    r = await ctrl.updateRegistro(ana, '1000', { titulo: 'Nuevo', desarrollo: 'Nuevo texto', parrafo: 'Durante este periodo se hizo B.' });
    assert.strictEqual(r.titulo, 'Nuevo');
    assert.strictEqual(r.parrafo, 'Durante este periodo se hizo B.');
    await assert.rejects(ctrl.updateRegistro(ana, '1000', { titulo: '  ', desarrollo: 'x' }), no(400));
    await assert.rejects(ctrl.updateRegistro(ana, '1000', { parrafo: ' ', desarrollo: 'x' }), no(400));
});

test('listRegistros sin actividad_id: todas las mías del mes; de otro usuario solo si puedo verlo', async () => {
    const { ctrl, db } = setup();
    db.st.actividades[101] = { id: 101, user_id: 1, nombre: 'Otra', descripcion: 'D', orden: 1 };
    db.st.registros[1001] = { id: 1001, actividad_id: 101, user_id: 1, mes: 10, anio: 2027, titulo: 'X', desarrollo: 'Y' };
    db.st.registros[1002] = { id: 1002, actividad_id: 200, user_id: 2, mes: 10, anio: 2027, titulo: 'De Beto', desarrollo: 'Z' };
    const ana = await ctrl.getActor('ana@x.co');
    const coord = await ctrl.getActor('coord@x.co');
    const regs = await ctrl.listRegistros(ana, { mes: '10', anio: '2027' });
    assert.deepStrictEqual(regs.map((r) => r.id).sort(), [1000, 1001]);
    assert.strictEqual(regs.find((r) => r.id === 1000).evidencias.length, 2);
    assert.strictEqual((await ctrl.listRegistros(coord, { mes: '10', anio: '2027', user_id: '1' })).length, 2);
    await assert.rejects(ctrl.listRegistros(coord, { mes: '10', anio: '2027', user_id: '2' }), no(404));
    await assert.rejects(ctrl.listRegistros(ana, { mes: '13', anio: '2027' }), no(400));
});

test('updateEvidencia: cambia el pie; ajena → 404; > 500 → 400', async () => {
    const { ctrl } = setup();
    const ana = await ctrl.getActor('ana@x.co');
    const beto = await ctrl.getActor('beto@x.co');
    const ev = await ctrl.updateEvidencia(ana, '5000', { descripcion: ' Pantalla de inicio ' });
    assert.strictEqual(ev.descripcion, 'Pantalla de inicio');
    assert.strictEqual((await ctrl.updateEvidencia(ana, '5000', { descripcion: '' })).descripcion, null);
    await assert.rejects(ctrl.updateEvidencia(beto, '5000', { descripcion: 'x' }), no(404));
    await assert.rejects(ctrl.updateEvidencia(ana, '5000', { descripcion: 'a'.repeat(501) }), no(400));
});

test('deleteRegistro borra archivos de sus evidencias de imagen', async () => {
    const { ctrl, storage } = setup();
    const ana = await ctrl.getActor('ana@x.co');
    await ctrl.deleteRegistro(ana, '1000');
    assert.deepStrictEqual(storage.borrados, ['1/a.png']);
});

test('addEvidencia: link debe ser http(s); imagen exige archivo; tipo inválido → 400', async () => {
    const { ctrl } = setup();
    const ana = await ctrl.getActor('ana@x.co');
    await assert.rejects(ctrl.addEvidencia(ana, { registro_id: '1000', tipo: 'link', contenido: 'javascript:alert(1)' }), no(400));
    await assert.rejects(ctrl.addEvidencia(ana, { registro_id: '1000', tipo: 'imagen' }, null), no(400));
    await assert.rejects(ctrl.addEvidencia(ana, { registro_id: '1000', tipo: 'video', contenido: 'x' }), no(400));
    const img = await ctrl.addEvidencia(ana, { registro_id: '1000', tipo: 'imagen', descripcion: 'Foto' }, { mimetype: 'image/png' });
    assert.strictEqual(img.contenido, '1/nuevo.png');
});

test('addEvidencia de imagen: si falla el insert se borra el archivo guardado', async () => {
    const { ctrl, db, storage } = setup();
    const ana = await ctrl.getActor('ana@x.co');
    db.onix.insertEvidencia = async () => { throw new Error('BD caída'); };
    await assert.rejects(ctrl.addEvidencia(ana, { registro_id: '1000', tipo: 'imagen' }, { mimetype: 'image/png' }));
    assert.deepStrictEqual(storage.borrados, ['1/nuevo.png']);
});

test('deleteEvidencia ajena → 404; propia de imagen borra el archivo', async () => {
    const { ctrl, storage } = setup();
    const beto = await ctrl.getActor('beto@x.co');
    const ana = await ctrl.getActor('ana@x.co');
    await assert.rejects(ctrl.deleteEvidencia(beto, '5000'), no(404));
    await ctrl.deleteEvidencia(ana, '5000');
    assert.deepStrictEqual(storage.borrados, ['1/a.png']);
});

test('getEvidenciaArchivo: solo imágenes y solo con acceso', async () => {
    const { ctrl } = setup();
    const ana = await ctrl.getActor('ana@x.co');
    const coord = await ctrl.getActor('coord@x.co');
    const beto = await ctrl.getActor('beto@x.co');
    assert.deepStrictEqual(await ctrl.getEvidenciaArchivo(ana, '5000'), { datos: Buffer.from('img'), mime: 'image/png' });
    assert.deepStrictEqual(await ctrl.getEvidenciaArchivo(coord, '5000'), { datos: Buffer.from('img'), mime: 'image/png' });
    await assert.rejects(ctrl.getEvidenciaArchivo(beto, '5000'), no(404));
    await assert.rejects(ctrl.getEvidenciaArchivo(ana, '5001'), no(404));
});
