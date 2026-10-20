const test = require('node:test');
const assert = require('node:assert');
const createAtomCtrl = require('../api/atom/controller');

// BD falsa: registra cada llamada para poder verificar qué se escribió.
const fakeDB = (overrides = {}) => {
    const calls = [];
    // `ret` puede ser un valor fijo o una función (p.ej. para leer el id que
    // mandó el controller) — en ambos casos la llamada queda en `calls`,
    // también cuando el valor lo pisa un override de un test puntual.
    const record = (name, ret) => async (...args) => { calls.push([name, ...args]); return typeof ret === 'function' ? ret(...args) : ret; };
    const atomDefaults = {
        getActor: undefined,
        listTasks: [],
        counts: { pendientes: 0, vencidas: 0, completadas: 0 },
        getTask: null,
        insertTask: undefined,
        updateTask: undefined,
        insertHistory: undefined,
        getHistory: [],
        insertComment: { id: 1 },
        getComments: [],
        insertSubtask: undefined,
        getSubtasks: [],
        getSubtask: null,
        setSubtaskDone: undefined,
        tasksVencenHoyOVencidas: [],
        existsAtomNotificationToday: false,
        usuariosActivos: [],
        statsGlobal: {},
    };
    const atomOverrides = overrides.atom || {};
    const atom = {};
    for (const key of Object.keys(atomDefaults)) {
        atom[key] = record(`atom.${key}`, key in atomOverrides ? atomOverrides[key] : atomDefaults[key]);
    }
    const { atom: _atomOverrides, ...restOverrides } = overrides;
    const db = {
        atom,
        insertNotification: record('insertNotification', { id: 500 }),
        addNotificationRecipient: record('addNotificationRecipient'),
        searchPlatformUsersShare: record('searchPlatformUsersShare', []),
        ...restOverrides,
    };
    return { db, calls };
};

const ACTOR_BASE = { user_id: 1, role_id: 2, role_name: 'docente', es_admin: false, puede_asignar: true };

test('getActor traduce la fila de BD a camelCase y lanza 403 si no es usuario de la plataforma', async () => {
    const { db } = fakeDB({ atom: { getActor: async () => null } });
    await assert.rejects(() => createAtomCtrl(db).getActor('nadie@x.com'), (err) => err.status === 403);

    const ok = await createAtomCtrl(fakeDB({ atom: { getActor: async () => ACTOR_BASE } }).db).getActor('a@x.com');
    assert.deepStrictEqual(ok, { userId: 1, roleId: 2, roleName: 'docente', esAdmin: false, puedeAsignar: true });
});

test('createTask: el creador es siempre el actor, aunque el body traiga otro created_by', async () => {
    const { db, calls } = fakeDB({
        atom: { insertTask: async (d) => ({ id: 10, ...d }) },
    });
    const ctrl = createAtomCtrl(db);
    const actor = { userId: 1, puedeAsignar: true };
    const task = await ctrl.createTask(actor, { title: 'Revisar informe', created_by: 999 });
    const [, insertArg] = calls.find(c => c[0] === 'atom.insertTask');
    assert.strictEqual(insertArg.created_by, 1);
    assert.strictEqual(task.title, 'Revisar informe');
});

test('createTask: sin título lanza 400', async () => {
    const { db } = fakeDB();
    const ctrl = createAtomCtrl(db);
    await assert.rejects(() => ctrl.createTask({ userId: 1, puedeAsignar: true }, { title: '  ' }));
});

test('createTask: asignar a otro sin permiso de asignación lanza 403', async () => {
    const { db } = fakeDB();
    const ctrl = createAtomCtrl(db);
    const actor = { userId: 1, puedeAsignar: false };
    await assert.rejects(() => ctrl.createTask(actor, { title: 'Tarea', assigned_to: 2 }));
});

test('createTask: asignar a otro con permiso notifica al asignado', async () => {
    const { db, calls } = fakeDB({
        atom: { insertTask: async (d) => ({ id: 11, ...d }) },
    });
    const ctrl = createAtomCtrl(db);
    await ctrl.createTask({ userId: 1, puedeAsignar: true }, { title: 'Tarea para Juan', assigned_to: 2 });

    const [, notif] = calls.find(c => c[0] === 'insertNotification');
    assert.strictEqual(notif.type, 'atom_asignacion');
    assert.strictEqual(notif.entity_id, 11);
    const [, , recipientId] = calls.find(c => c[0] === 'addNotificationRecipient');
    assert.strictEqual(recipientId, 2);
});

test('createTask: asignarse a sí mismo no genera notificación', async () => {
    const { db, calls } = fakeDB({ atom: { insertTask: async (d) => ({ id: 12, ...d }) } });
    const ctrl = createAtomCtrl(db);
    await ctrl.createTask({ userId: 1, puedeAsignar: true }, { title: 'Mi tarea', assigned_to: 1 });
    assert.ok(!calls.some(c => c[0] === 'insertNotification'));
});

test('cargarPropia (vía getTaskDetalle): dueño, asignado o admin tienen acceso; un tercero recibe 404', async () => {
    const tarea = { id: 7, created_by: 1, assigned_to: 2, title: 'X' };
    const { db } = fakeDB({ atom: { getTask: async () => tarea } });
    const ctrl = createAtomCtrl(db);

    await assert.doesNotReject(() => ctrl.getTaskDetalle({ userId: 1, esAdmin: false }, 7)); // dueño
    await assert.doesNotReject(() => ctrl.getTaskDetalle({ userId: 2, esAdmin: false }, 7)); // asignado
    await assert.doesNotReject(() => ctrl.getTaskDetalle({ userId: 999, esAdmin: true }, 7)); // admin
    await assert.rejects(() => ctrl.getTaskDetalle({ userId: 999, esAdmin: false }, 7)); // ajeno -> 404
});

test('updateTask: solo registra historial de los campos que de verdad cambiaron', async () => {
    const tarea = {
        id: 5, created_by: 1, assigned_to: null, title: 'Original', description: null,
        priority: 'Media', status: 'Pendiente', category: null, due_date: null,
    };
    const { db, calls } = fakeDB({
        atom: {
            getTask: async () => tarea,
            updateTask: async (id, d) => ({ id, created_by: 1, assigned_to: null, ...d }),
        },
    });
    const ctrl = createAtomCtrl(db);
    await ctrl.updateTask({ userId: 1, esAdmin: false, puedeAsignar: true }, 5, { title: 'Original', priority: 'Alta' });

    const historiales = calls.filter(c => c[0] === 'atom.insertHistory');
    assert.strictEqual(historiales.length, 1);
    assert.strictEqual(historiales[0][3], 'priority');
    assert.strictEqual(historiales[0][4], 'Media');
    assert.strictEqual(historiales[0][5], 'Alta');
});

test('updateTask: completar una tarea ajena notifica al creador, no a quien la completó', async () => {
    const tarea = { id: 6, created_by: 1, assigned_to: 2, title: 'Tarea compartida', priority: 'Media', status: 'Pendiente', description: null, category: null, due_date: null };
    const { db, calls } = fakeDB({
        atom: { getTask: async () => tarea, updateTask: async (id, d) => ({ id, created_by: 1, assigned_to: 2, ...d }) },
    });
    const ctrl = createAtomCtrl(db);
    await ctrl.updateTask({ userId: 2, esAdmin: false, puedeAsignar: true }, 6, { status: 'Completada' });

    const [, notif] = calls.find(c => c[0] === 'insertNotification');
    assert.strictEqual(notif.type, 'atom_completada');
    const [, , recipientId] = calls.find(c => c[0] === 'addNotificationRecipient');
    assert.strictEqual(recipientId, 1);
});

test('addComment: notifica a la contraparte (creador <-> asignado), nunca a quien comenta', async () => {
    const tarea = { id: 8, created_by: 1, assigned_to: 2, title: 'Con comentario' };
    const { db, calls } = fakeDB({ atom: { getTask: async () => tarea } });
    const ctrl = createAtomCtrl(db);
    await ctrl.addComment({ userId: 1, esAdmin: false }, 8, { body: 'Avanza bien' });

    const [, , recipientId] = calls.find(c => c[0] === 'addNotificationRecipient');
    assert.strictEqual(recipientId, 2);
});

test('addComment: comentario vacío lanza 400', async () => {
    const tarea = { id: 9, created_by: 1, assigned_to: null, title: 'Sin comentarios' };
    const { db } = fakeDB({ atom: { getTask: async () => tarea } });
    const ctrl = createAtomCtrl(db);
    await assert.rejects(() => ctrl.addComment({ userId: 1, esAdmin: false }, 9, { body: '   ' }));
});

test('bulkEstado: tareas ajenas quedan ok:false sin tumbar el resto del lote', async () => {
    const tareas = { 1: { id: 1, created_by: 1, assigned_to: null, title: 'A', priority: 'Media', status: 'Pendiente', description: null, category: null, due_date: null } };
    const { db, calls } = fakeDB({
        atom: {
            getTask: async (id) => tareas[id] || null,
            updateTask: async (id, d) => ({ id, ...d }),
        },
    });
    const ctrl = createAtomCtrl(db);
    const resultados = await ctrl.bulkEstado({ userId: 1, esAdmin: false }, [1, 2], 'Completada');

    assert.deepStrictEqual(resultados.find(r => r.id === 1), { id: 1, ok: true });
    assert.strictEqual(resultados.find(r => r.id === 2).ok, false);
    assert.ok(calls.some(c => c[0] === 'atom.updateTask' && c[1] === 1));
    assert.ok(!calls.some(c => c[0] === 'atom.updateTask' && c[1] === 2));
});

test('listTasks: "todas" solo se envía como true cuando el actor es admin', async () => {
    const { db, calls } = fakeDB();
    const ctrl = createAtomCtrl(db);
    await ctrl.listTasks({ userId: 1, esAdmin: false }, { todas: true });
    await ctrl.listTasks({ userId: 1, esAdmin: true }, { todas: true });

    const llamadas = calls.filter(c => c[0] === 'atom.listTasks');
    assert.strictEqual(llamadas[0][2], false, 'sin atom_admin, todas debe ignorarse');
    assert.strictEqual(llamadas[1][2], true, 'con atom_admin, todas se respeta');
});

test('updateTask: subir la prioridad a Alta/Urgente notifica a la contraparte, bajarla no', async () => {
    const base = { id: 20, created_by: 1, assigned_to: 2, title: 'Prioridad', description: null, status: 'Pendiente', category: null, due_date: null };
    const { db: db1, calls: calls1 } = fakeDB({
        atom: { getTask: async () => ({ ...base, priority: 'Media' }), updateTask: async (id, d) => ({ ...base, id, ...d }) },
    });
    await createAtomCtrl(db1).updateTask({ userId: 1, esAdmin: false, puedeAsignar: true }, 20, { priority: 'Urgente' });
    assert.ok(calls1.some(c => c[0] === 'insertNotification' && c[1].type === 'atom_prioridad'));

    const { db: db2, calls: calls2 } = fakeDB({
        atom: { getTask: async () => ({ ...base, priority: 'Alta' }), updateTask: async (id, d) => ({ ...base, id, ...d }) },
    });
    await createAtomCtrl(db2).updateTask({ userId: 1, esAdmin: false, puedeAsignar: true }, 20, { priority: 'Baja' });
    assert.ok(!calls2.some(c => c[0] === 'insertNotification' && c[1].type === 'atom_prioridad'));
});

test('updateTask: cancelar notifica al asignado; completar ajena notifica al creador (ya cubierto arriba)', async () => {
    const tarea = { id: 21, created_by: 1, assigned_to: 2, title: 'Cancelar', priority: 'Media', description: null, category: null, due_date: null, status: 'Pendiente' };
    const { db, calls } = fakeDB({
        atom: { getTask: async () => tarea, updateTask: async (id, d) => ({ id, created_by: 1, assigned_to: 2, ...d }) },
    });
    await createAtomCtrl(db).updateTask({ userId: 1, esAdmin: false, puedeAsignar: true }, 21, { status: 'Cancelada' });

    const [, notif] = calls.find(c => c[0] === 'insertNotification');
    assert.strictEqual(notif.type, 'atom_cancelada');
    const [, , recipientId] = calls.find(c => c[0] === 'addNotificationRecipient');
    assert.strictEqual(recipientId, 2);
});

test('updateTask: reasignar notifica al nuevo Y al anterior, nunca al propio actor', async () => {
    const tarea = { id: 22, created_by: 1, assigned_to: 2, title: 'Reasignar', priority: 'Media', description: null, category: null, due_date: null, status: 'Pendiente' };
    const { db, calls } = fakeDB({
        atom: { getTask: async () => tarea, updateTask: async (id, d) => ({ id, created_by: 1, ...d }) },
    });
    await createAtomCtrl(db).updateTask({ userId: 1, esAdmin: false, puedeAsignar: true }, 22, { assigned_to: 3 });

    const recipients = calls.filter(c => c[0] === 'addNotificationRecipient').map(c => c[2]);
    assert.ok(recipients.includes(3), 'el nuevo asignado debe enterarse');
    assert.ok(recipients.includes(2), 'a quien le quitaron la tarea también debe enterarse');
});

test('bulkEstado: cancelar en lote también notifica al asignado (mismo helper que updateTask)', async () => {
    const tarea = { id: 23, created_by: 1, assigned_to: 2, title: 'Lote', priority: 'Media', description: null, category: null, due_date: null, status: 'Pendiente' };
    const { db, calls } = fakeDB({
        atom: { getTask: async () => tarea, updateTask: async (id, d) => ({ id, created_by: 1, assigned_to: 2, ...d }) },
    });
    await createAtomCtrl(db).bulkEstado({ userId: 1, esAdmin: false }, [23], 'Cancelada');

    assert.ok(calls.some(c => c[0] === 'insertNotification' && c[1].type === 'atom_cancelada'));
});

test('toggleSubtask: avisa a la contraparte solo cuando la última subtarea pendiente se marca', async () => {
    const tarea = { id: 24, created_by: 1, assigned_to: 2, title: 'Subtareas', status: 'Pendiente' };
    const sub = { id: 100, task_id: 24, done: false };
    const { db, calls } = fakeDB({
        atom: {
            getTask: async () => tarea,
            getSubtask: async () => sub,
            setSubtaskDone: async (id, done) => ({ id, done }),
            getSubtasks: async () => [{ id: 99, done: true }, { id: 100, done: true }],
        },
    });
    await createAtomCtrl(db).toggleSubtask({ userId: 1, esAdmin: false }, 24, 100, true);

    const [, notif] = calls.find(c => c[0] === 'insertNotification');
    assert.strictEqual(notif.type, 'atom_subtareas_completas');
});

test('toggleSubtask: si todavía queda alguna pendiente, no notifica', async () => {
    const tarea = { id: 25, created_by: 1, assigned_to: 2, title: 'Subtareas', status: 'Pendiente' };
    const sub = { id: 101, task_id: 25, done: false };
    const { db, calls } = fakeDB({
        atom: {
            getTask: async () => tarea,
            getSubtask: async () => sub,
            setSubtaskDone: async (id, done) => ({ id, done }),
            getSubtasks: async () => [{ id: 100, done: false }, { id: 101, done: true }],
        },
    });
    await createAtomCtrl(db).toggleSubtask({ userId: 1, esAdmin: false }, 25, 101, true);
    assert.ok(!calls.some(c => c[0] === 'insertNotification'));
});

test('addComment: "@username" menciona y notifica a ese usuario activo (username con espacios incluido)', async () => {
    const tarea = { id: 26, created_by: 1, assigned_to: null, title: 'Mención' };
    const { db, calls } = fakeDB({
        atom: {
            getTask: async () => tarea,
            usuariosActivos: [{ id: 5, username: 'Jennifer Ospina' }, { id: 6, username: 'Marcos Duque' }],
        },
    });
    await createAtomCtrl(db).addComment({ userId: 1, esAdmin: false }, 26, { body: 'Ojo @Jennifer Ospina, revisa esto' });

    const recipients = calls.filter(c => c[0] === 'addNotificationRecipient').map(c => c[2]);
    assert.ok(recipients.includes(5));
    assert.ok(!recipients.includes(6), 'quien no fue mencionado no debe notificarse');
});

test('addComment: no se auto-notifica a quien comenta aunque su propio username aparezca en el texto', async () => {
    const tarea = { id: 27, created_by: 1, assigned_to: null, title: 'Mención propia' };
    const { db, calls } = fakeDB({
        atom: { getTask: async () => tarea, usuariosActivos: [{ id: 1, username: 'Evelyn Arango' }] },
    });
    await createAtomCtrl(db).addComment({ userId: 1, esAdmin: false }, 27, { body: 'Yo @Evelyn Arango me encargo' });
    assert.ok(!calls.some(c => c[0] === 'insertNotification' && c[1].type === 'atom_mencion'));
});
