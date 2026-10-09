const test = require('node:test');
const assert = require('node:assert');
const createSicauCtrl = require('../api/SICAU/controller');

// BD falsa mínima para saveSicauUsuario: registra cada llamada para poder
// verificar qué se escribió (mismo patrón que test/sicauNovedades.test.js).
const fakeDB = (overrides = {}) => {
    const calls = [];
    const record = (name, ret) => async (...args) => { calls.push([name, ...args]); return ret; };
    const db = {
        findUserByDoc: record('findUserByDoc', [{ id: 7 }]),
        getUserCompareFields: record('getUserCompareFields', [{ email: 'ya@pascualbravo.edu.co', estado: 'Matriculado' }]),
        setUserNovedadDatos: record('setUserNovedadDatos'),
        updateUserFromSicau: record('updateUserFromSicau'),
        ...overrides,
    };
    return { db, calls };
};

test('cambio de estado de un usuario existente queda registrado en novedad_datos', async () => {
    const { db, calls } = fakeDB();
    await createSicauCtrl(db).saveSicauUsuario({
        documento: '1111111124', username: 'est.prueba', email: 'ya@pascualbravo.edu.co', estado: 'Retirado',
    });

    const [, , cambios] = calls.find(c => c[0] === 'setUserNovedadDatos');
    assert.ok(cambios.some(c => c.campo === 'estado' && c.anterior === 'Matriculado' && c.actual === 'Retirado'));
});

test('usuario existente sin cambio de estado no registra novedad_datos por ese campo', async () => {
    const { db, calls } = fakeDB();
    await createSicauCtrl(db).saveSicauUsuario({
        documento: '1111111124', username: 'est.prueba', email: 'ya@pascualbravo.edu.co', estado: 'Matriculado',
    });

    const llamada = calls.find(c => c[0] === 'setUserNovedadDatos');
    assert.ok(!llamada || !llamada[2].some(c => c.campo === 'estado'));
});

test('usuario existente sin mandar estado no lo toca ni lo marca como novedad', async () => {
    const { db, calls } = fakeDB();
    await createSicauCtrl(db).saveSicauUsuario({
        documento: '1111111124', username: 'est.prueba', email: 'ya@pascualbravo.edu.co',
    });

    const llamada = calls.find(c => c[0] === 'setUserNovedadDatos');
    assert.ok(!llamada || !llamada[2].some(c => c.campo === 'estado'));
});
