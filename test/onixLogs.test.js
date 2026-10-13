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
