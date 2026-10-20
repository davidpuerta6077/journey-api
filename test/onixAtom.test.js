const test = require('node:test');
const assert = require('node:assert');
const { setup, no } = require('./onixFakes');

const tareas = [
    { uid: 1, id: 7, title: 'Montar aulas 2026-2', description: 'Crear y configurar las aulas del semestre', status: 'Completada', priority: 'Alta', category: null,
        fecha: new Date('2027-10-03T15:00:00Z'), subtareas: 3, subtareas_hechas: 3, hechas: 'Crear cursos; Matricular; Revisar' },
    { uid: 1, id: 8, title: 'Manual de usuario', description: '', status: 'En proceso', priority: 'Media', category: null,
        fecha: new Date('2027-10-10T15:00:00Z'), subtareas: 0, subtareas_hechas: 0, hechas: null },
    { uid: 2, id: 9, title: 'Ajena', description: '', status: 'Completada', priority: 'Media', fecha: new Date('2027-10-05T15:00:00Z'), subtareas: 0, subtareas_hechas: 0, hechas: null },
];

test('tareas de Atom del mes: solo las propias; las usadas en el mes no se ofrecen, pero sí en otro mes', async () => {
    const { ctrl } = setup({ tareasAtom: [...tareas, { ...tareas[1], fecha: new Date('2027-11-04T15:00:00Z') }] });
    const ana = await ctrl.getActor('ana@x.co');
    const oct = await ctrl.listTareasAtom(ana, { mes: '10', anio: '2027' });
    assert.deepStrictEqual(oct.map((t) => t.id), [7, 8]);
    assert.strictEqual(oct[0].estado, 'Completada');
    await ctrl.registroDesdeAtom(ana, { actividad_id: '100', mes: '10', anio: '2027', tarea_ids: [8] });
    assert.deepStrictEqual((await ctrl.listTareasAtom(ana, { mes: '10', anio: '2027' })).map((t) => t.id), [7]);
    assert.deepStrictEqual((await ctrl.listTareasAtom(ana, { mes: '11', anio: '2027' })).map((t) => t.id), [8]);
});

test('registroDesdeAtom arma el texto con estado, subtareas y descripción; ajena → 404, vacío → 400, repetida → 409', async () => {
    const { ctrl, db } = setup({ tareasAtom: tareas });
    const ana = await ctrl.getActor('ana@x.co');
    const base = { actividad_id: '100', mes: '10', anio: '2027' };
    await assert.rejects(ctrl.registroDesdeAtom(ana, { ...base, tarea_ids: [9] }), no(404));
    await assert.rejects(ctrl.registroDesdeAtom(ana, { ...base, tarea_ids: [] }), no(400));
    const r = await ctrl.registroDesdeAtom(ana, { ...base, tarea_ids: [8, 7] });
    assert.deepStrictEqual(r.desarrollo.split('\n'), [
        '- 03/10/2027: Tarea "Montar aulas 2026-2" (Completada, 3/3 subtareas): Crear y configurar las aulas del semestre. Subtareas hechas: Crear cursos; Matricular; Revisar',
        '- 10/10/2027: Tarea "Manual de usuario" (En proceso)',
    ]);
    assert.strictEqual(r.titulo, 'Tareas del mes');
    assert.strictEqual(r.tareas, 2);
    assert.strictEqual(db.st.eventosUsados['atom:7:2027-10'].registroId, r.id);
    await assert.rejects(ctrl.registroDesdeAtom(ana, { ...base, tarea_ids: [7] }), no(409));
});
