const test = require('node:test');
const assert = require('node:assert');
const { setup, no } = require('./onixFakes');

test('listLogsDisponibles: solo mis acciones del mes (sin importar mayúsculas en el correo)', async () => {
    const { ctrl } = setup();
    const ana = await ctrl.getActor('ana@x.co');
    const logs = await ctrl.listLogsDisponibles(ana, { mes: '10', anio: '2027' });
    assert.deepStrictEqual(logs.map((l) => l.id).sort(), [700, 701]);
    assert.deepStrictEqual(await ctrl.listLogsDisponibles(ana, { mes: '9', anio: '2027' }), []);
    await assert.rejects(ctrl.listLogsDisponibles(ana, { mes: '13', anio: '2027' }), no(400));
});

test('registroDesdeLogs junta las acciones en un registro, en orden de fecha, y las marca como usadas', async () => {
    const { ctrl, db } = setup();
    const ana = await ctrl.getActor('ana@x.co');
    const r = await ctrl.registroDesdeLogs(ana, { actividad_id: '100', mes: '10', anio: '2027', log_ids: [700, '701'] });
    const lineas = r.desarrollo.split('\n');
    assert.strictEqual(lineas.length, 2);
    assert.match(lineas[0], /^- 02\/10\/2027: Editó el curso "Programación Web"$/);
    assert.match(lineas[1], /^- 05\/10\/2027: Sincronizó 3 usuarios con Moodle$/);
    assert.strictEqual(r.actividad_nombre, 'Soporte');
    assert.strictEqual(r.logs, 2);
    assert.strictEqual(r.titulo, 'Acciones en Bravo Hub');
    assert.strictEqual(db.st.registroLogs[700], r.id);
    assert.deepStrictEqual(await ctrl.listLogsDisponibles(ana, { mes: '10', anio: '2027' }), []);
});

test('registroDesdeLogs con una acción de otro usuario o inexistente → 404 y no crea nada', async () => {
    const { ctrl, db } = setup();
    const ana = await ctrl.getActor('ana@x.co');
    const antes = Object.keys(db.st.registros).length;
    await assert.rejects(ctrl.registroDesdeLogs(ana, { actividad_id: '100', mes: '10', anio: '2027', log_ids: [700, 702] }), no(404));
    await assert.rejects(ctrl.registroDesdeLogs(ana, { actividad_id: '100', mes: '10', anio: '2027', log_ids: [999] }), no(404));
    assert.strictEqual(Object.keys(db.st.registros).length, antes);
});

test('registroDesdeLogs: acción ya asignada → 409; sin selección o ids inválidos → 400', async () => {
    const { ctrl } = setup();
    const ana = await ctrl.getActor('ana@x.co');
    await ctrl.registroDesdeLogs(ana, { actividad_id: '100', mes: '10', anio: '2027', log_ids: [700] });
    await assert.rejects(ctrl.registroDesdeLogs(ana, { actividad_id: '100', mes: '10', anio: '2027', log_ids: [700, 701] }), no(409));
    await assert.rejects(ctrl.registroDesdeLogs(ana, { actividad_id: '100', mes: '10', anio: '2027', log_ids: [] }), no(400));
    await assert.rejects(ctrl.registroDesdeLogs(ana, { actividad_id: '100', mes: '10', anio: '2027', log_ids: ['abc'] }), no(400));
});

test('registroDesdeLogs en actividad ajena → 404', async () => {
    const { ctrl } = setup();
    const ana = await ctrl.getActor('ana@x.co');
    await assert.rejects(ctrl.registroDesdeLogs(ana, { actividad_id: '200', mes: '10', anio: '2027', log_ids: [700] }), no(404));
});

test('si falla el enlace por carrera (otra pestaña lo usó), se borra el registro creado → 409', async () => {
    const { ctrl, db } = setup();
    const ana = await ctrl.getActor('ana@x.co');
    db.onix.insertRegistroLogs = async () => { const e = new Error('dup'); e.code = '23505'; throw e; };
    const antes = Object.keys(db.st.registros).length;
    await assert.rejects(ctrl.registroDesdeLogs(ana, { actividad_id: '100', mes: '10', anio: '2027', log_ids: [700] }), no(409));
    assert.strictEqual(Object.keys(db.st.registros).length, antes);
});

test('registroDesdeLogs usa el título enviado', async () => {
    const { ctrl } = setup();
    const ana = await ctrl.getActor('ana@x.co');
    const r = await ctrl.registroDesdeLogs(ana, { actividad_id: '100', mes: '10', anio: '2027', log_ids: [700], titulo: ' Sincronizaciones ' });
    assert.strictEqual(r.titulo, 'Sincronizaciones');
});

test('registroDesdeLogs junta las acciones repetidas del mismo día en una línea con la cantidad', async () => {
    const { ctrl } = setup({
        logs: {
            700: { id: 700, date: new Date('2027-10-05T15:00:00Z'), username: 'ana@x.co', type: 'post', entity_type: 'sync_users', description: 'Sincronizó usuarios' },
            703: { id: 703, date: new Date('2027-10-05T18:00:00Z'), username: 'ana@x.co', type: 'post', entity_type: 'sync_users', description: 'Sincronizó usuarios' },
            704: { id: 704, date: new Date('2027-10-06T15:00:00Z'), username: 'ana@x.co', type: 'post', entity_type: 'sync_users', description: 'Sincronizó usuarios' },
        },
    });
    const ana = await ctrl.getActor('ana@x.co');
    const r = await ctrl.registroDesdeLogs(ana, { actividad_id: '100', mes: '10', anio: '2027', log_ids: [700, 703, 704] });
    assert.deepStrictEqual(r.desarrollo.split('\n'), ['- 05/10/2027: Sincronizó usuarios (2 veces)', '- 06/10/2027: Sincronizó usuarios']);
    assert.strictEqual(r.logs, 3);
});

test('registroDesdeLogs con registro_id agrega las acciones a una subactividad existente', async () => {
    const { ctrl, db } = setup();
    const ana = await ctrl.getActor('ana@x.co');
    const r = await ctrl.registroDesdeLogs(ana, { actividad_id: '100', mes: '10', anio: '2027', log_ids: [700], registro_id: '1000' });
    assert.strictEqual(r.id, 1000);
    assert.strictEqual(r.desarrollo, 'Atendí 30 tickets\n- 05/10/2027: Sincronizó 3 usuarios con Moodle');
    assert.strictEqual(db.st.registroLogs[700], 1000);
    assert.strictEqual(Object.keys(db.st.registros).length, 1);
});

test('registroDesdeLogs con registro_id de otra actividad, otro mes o ajeno → 404', async () => {
    const { ctrl, db } = setup();
    db.st.registros[1001] = { id: 1001, actividad_id: 100, user_id: 1, mes: 9, anio: 2027, desarrollo: 'x' };
    db.st.registros[1002] = { id: 1002, actividad_id: 200, user_id: 2, mes: 10, anio: 2027, desarrollo: 'x' };
    const ana = await ctrl.getActor('ana@x.co');
    for (const registro_id of ['1001', '1002', '999']) {
        await assert.rejects(ctrl.registroDesdeLogs(ana, { actividad_id: '100', mes: '10', anio: '2027', log_ids: [700], registro_id }), no(404));
    }
    assert.strictEqual(db.st.registroLogs[700], undefined);
});
