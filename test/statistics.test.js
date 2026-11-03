const test = require('node:test');
const assert = require('node:assert');
const createCtrl = require('../api/statistics/controller');

// BD falsa: responde según palabras del SQL.
const fakeDB = (respuestas) => ({
    query: async ({ text }) => {
        for (const [patron, filas] of respuestas) if (patron.test(text)) return filas;
        return [];
    },
});

test('estadísticas: app o periodo no soportado = 400', async () => {
    const ctrl = createCtrl(fakeDB([]));
    await assert.rejects(ctrl.estadisticas('nope', 30), (e) => e.status === 400);
    await assert.rejects(ctrl.estadisticas('general', 12), (e) => e.status === 400);
});

test('estadísticas generales: cifras con periodo anterior y líneas sin huecos', async () => {
    const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
    const ctrl = createCtrl(fakeDB([
        [/AS acciones,/, [{ acciones: 10, acciones_ant: 4, usuarios: 3, usuarios_ant: 2, usuarios_hub: 9 }]],
        [/AS app, count/, [{ dia: hoy, app: 'nexo_sync', n: 7 }, { dia: hoy, app: 'atom', n: 3 }]],
    ]));
    const r = await ctrl.estadisticas('general', '7');
    assert.strictEqual(r.dias, 7);
    assert.deepStrictEqual(r.kpis[0], { label: 'Usuarios activos', valor: 3, anterior: 2, icono: 'usuarios', nota: 'de 9 con acceso a Bravo Hub' });
    assert.strictEqual(r.kpis[2].valor, 'Nexo');
    const [lineas, uso] = r.graficos;
    assert.strictEqual(lineas.dias.length, 7);
    assert.strictEqual(lineas.dias[6], hoy);
    assert.deepStrictEqual(lineas.series.find((s) => s.nombre === 'Nexo').valores, [0, 0, 0, 0, 0, 0, 7]);
    assert.deepStrictEqual(uso.data, [{ nombre: 'Nexo', valor: 7 }, { nombre: 'Atom', valor: 3 }]);
});

test('estadísticas de Atom: porcentaje a tiempo y alerta de vencidas', async () => {
    const ctrl = createCtrl(fakeDB([
        [/AS abiertas/, [{ abiertas: 4, vencidas: 2, completadas: 5, completadas_ant: 1, con_fecha: 4, a_tiempo: 3 }]],
    ]));
    const r = await ctrl.estadisticas('atom', 30);
    assert.strictEqual(r.kpis[1].tono, 'alerta');
    assert.strictEqual(r.kpis[3].valor, '75 %');
});

test('estadísticas: mapa de calor 7×24 con lunes primero y medidor en porcentaje', async () => {
    const ctrl = createCtrl(fakeDB([
        [/AS acciones,/, [{ acciones: 4, acciones_ant: 0, usuarios: 3, usuarios_ant: 0, usuarios_hub: 4 }]],
        [/isodow/, [{ dow: 1, hora: 9, n: 2 }, { dow: 7, hora: 23, n: 5 }]],
    ]));
    const r = await ctrl.estadisticas('general', 30);
    const calor = r.graficos.find((g) => g.tipo === 'calor');
    assert.strictEqual(calor.celdas.length, 7);
    assert.strictEqual(calor.celdas[0].length, 24);
    assert.strictEqual(calor.celdas[0][9], 2);
    assert.strictEqual(calor.celdas[6][23], 5);
    const medidor = r.graficos.find((g) => g.tipo === 'medidor');
    assert.strictEqual(medidor.valor, 75);
    assert.strictEqual(medidor.detalle, '3 de 4 usuarios con acceso');
});
