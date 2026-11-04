const test = require('node:test');
const assert = require('node:assert');
const { parseMatriz, parseDia } = require('../api/asignia/parser');
const createController = require('../api/asignia/controller');
const { planCarga } = createController;

const no = (status) => (e) => e.status === status;

const ENC = ['Periodo', 'NombreSede  ', 'Programa', 'Plan', 'Código', 'Curso', 'Grupo\nSICAU', 'curso ', 'Jornada',
    'Lunes', 'martes', 'PROFESOR ', 'Documento', 'Correo Institucional'];

test('parseDia: rango + aula, varios rangos, fecha convertida por Excel y rango con texto', () => {
    assert.deepStrictEqual(parseDia('Lunes', '06-08\nB6-306B'), [{ dia: 'Lunes', hora: '06:00 - 08:00', aula: 'B6-306B' }]);
    assert.deepStrictEqual(parseDia('Martes', '6-8\n8-10\nVirtual').map((h) => h.hora), ['06:00 - 08:00', '08:00 - 10:00']);
    assert.deepStrictEqual(parseDia('Jueves', '2026-08-06'), [{ dia: 'Jueves', hora: '06:00 - 08:00', aula: '' }]);
    assert.deepStrictEqual(parseDia('Viernes', '18-22 Remoto'), [{ dia: 'Viernes', hora: '18:00 - 22:00', aula: 'Remoto' }]);
    assert.deepStrictEqual(parseDia('Sábado', '  '), []);
});

test('parseMatriz: encabezados sin tildes/espacios, primer "Curso" gana, N/A = sin profesor', () => {
    const { filas, omitidas } = parseMatriz([
        ENC,
        ['2027-1', 'Robledo', '018 - SOFTWARE', '20251', 'SD1002', 'LÓGICA', '810', 'SD1002 LÓGICA 810', 'Diurna',
            '', '08-10\nB6-306A', 'DAVID  PULGARIN', 1214727158, 'David.Pulgarin@pascualbravo.edu.co'],
        ['2027-1', 'Robledo', '018 - SOFTWARE', '20251', 'FB1200', 'ALGEBRA', '', '', 'Diurna',
            '06-08\nB6-306B', '', 'N/A', 'N/A', ''],
        ['', '', '', '', '', 'sin código', '', '', '', '', '', '', '', ''],
        ['', '', '', '', '', '', '', '', '', '', '', '', '', ''],
    ]);
    assert.strictEqual(omitidas, 1);
    assert.strictEqual(filas.length, 2);
    assert.strictEqual(filas[0].curso, 'LÓGICA');
    assert.strictEqual(filas[0].sede, 'Robledo');
    assert.strictEqual(filas[0].grupo, '810');
    assert.strictEqual(filas[0].profesor_nombre, 'DAVID PULGARIN');
    assert.strictEqual(filas[0].profesor_documento, '1214727158');
    assert.strictEqual(filas[0].profesor_correo, 'david.pulgarin@pascualbravo.edu.co');
    assert.deepStrictEqual(filas[0].horario, [{ dia: 'Martes', hora: '08:00 - 10:00', aula: 'B6-306A' }]);
    assert.strictEqual(filas[1].profesor_nombre, '');
    assert.strictEqual(filas[1].profesor_documento, '');
});

test('parseMatriz: faltan columnas obligatorias → 400', () => {
    assert.throws(() => parseMatriz([['Código', 'Curso', 'Jornada']]), (e) => e.status === 400 && /Profesor/.test(e.message));
    assert.throws(() => parseMatriz([['nada']]), no(400));
});

const fila = (o = {}) => ({
    sede: 'Robledo', programa: 'P', plan: '1', nivel: '1', codigo: 'C1', curso: 'Curso', grupo: '1', agrupamiento: '1',
    creditos: '3', horas_semana: '4', espacio: '', jornada: 'Diurna', horario: [],
    profesor_nombre: '', profesor_documento: '', profesor_correo: '', vinculacion: '', ...o,
});
const ana = { profesor_nombre: 'ANA', profesor_documento: '111111', profesor_correo: 'ana@pascualbravo.edu.co' };
const beto = { profesor_nombre: 'BETO', profesor_documento: '222222', profesor_correo: 'beto@pascualbravo.edu.co' };

test('planCarga: nuevos según profesor, conserva estado con mismo profesor, reinicia si cambia', () => {
    const existentes = [
        { id: 1, ...fila({ codigo: 'A', ...ana }), verificacion: 'aceptado' },
        { id: 2, ...fila({ codigo: 'B', ...ana }), verificacion: 'rechazado' },
        { id: 3, ...fila({ codigo: 'C', ...ana }), verificacion: 'aceptado' },
        { id: 4, ...fila({ codigo: 'D' }), verificacion: 'postulado' },
        { id: 5, ...fila({ codigo: 'Z' }), verificacion: 'vacio' },
    ];
    const r = planCarga(existentes, [
        fila({ codigo: 'A', ...ana }),                  // igual → sin cambios
        fila({ codigo: 'B', ...beto }),                 // otro profesor → asignado, reset
        fila({ codigo: 'C' }),                          // archivo sin profesor, ya aceptado → conserva
        fila({ codigo: 'D', curso: 'Nuevo nombre' }),   // postulado sin profesor → conserva estado, actualiza curso
        fila({ codigo: 'N', ...beto }),                 // nuevo con profesor → asignado
        fila({ codigo: 'M' }),                          // nuevo sin profesor → vacio
        fila({ codigo: 'M' }),                          // duplicada en el archivo
    ]);
    assert.deepStrictEqual(r.inserts.map((f) => [f.codigo, f.verificacion]), [['N', 'asignado'], ['M', 'vacio']]);
    assert.deepStrictEqual(r.updates.map((f) => [f.id, f.verificacion, f.reset, f.profesor_nombre]),
        [[2, 'asignado', true, 'BETO'], [4, 'postulado', false, '']]);
    assert.strictEqual(r.sinCambios, 2);
    assert.strictEqual(r.duplicadas, 1);
    assert.strictEqual(r.noEnArchivo, 1);
});

test('planCarga: horario igual con claves en otro orden (jsonb) no cuenta como cambio', () => {
    const horario = [{ dia: 'Lunes', hora: '06:00 - 08:00', aula: 'X' }];
    const r = planCarga([{ id: 1, ...fila({ horario: [{ aula: 'X', dia: 'Lunes', hora: '06:00 - 08:00' }] }), verificacion: 'vacio' }],
        [fila({ horario })]);
    assert.strictEqual(r.sinCambios, 1);
});

function setup() {
    const st = { logs: [], llamadas: [] };
    const db = {
        insertLog: async (...a) => { st.logs.push(a); },
        asignia: {
            getPeriodoActual: async () => '2027-1',
            cursosProfesor: async () => [],
            postulacionesProfesor: async () => [],
            getNombreProfesor: async (doc) => (doc === '111111' ? 'ANA' : null),
            responderAsignacion: async (ids, doc, correo, estado, motivo) => {
                st.llamadas.push({ ids, doc, correo, estado, motivo });
                return ids.filter((i) => i < 100).map((id) => ({ id, codigo: 'C' + id, curso: 'X', grupo: '1', profesor_nombre: 'ANA' }));
            },
            postular: async (periodo, ids, doc, correo, nombre) => {
                st.llamadas.push({ periodo, ids, nombre });
                return ids.map((id) => ({ id, codigo: 'C' + id, curso: 'X', grupo: '1' }));
            },
        },
    };
    return { st, ctrl: createController(db) };
}

test('identidad pública: documento numérico y correo institucional obligatorios', async () => {
    const { ctrl } = setup();
    await assert.rejects(ctrl.consultar({ documento: '12', correo: 'a@pascualbravo.edu.co' }), no(400));
    await assert.rejects(ctrl.consultar({ documento: '111111', correo: 'a@gmail.com' }), no(400));
    await assert.rejects(ctrl.consultar({ documento: '111111', correo: '@pascualbravo.edu.co' }), no(400));
    const r = await ctrl.consultar({ documento: '111.111', correo: ' ANA@pascualbravo.edu.co ' });
    assert.strictEqual(r.nombre, 'ANA');
    assert.strictEqual(r.periodo, '2027-1');
});

test('responder: normaliza identidad, guarda motivo solo al rechazar, 409 si nada cambió, deja log', async () => {
    const { ctrl, st } = setup();
    const id = { documento: '111111', correo: 'ANA@pascualbravo.edu.co' };
    assert.deepStrictEqual(await ctrl.responder({ ...id, ids: [1, '2', 2], motivo: 'x' }, 'aceptar'), { actualizados: 2, estado: 'aceptado' });
    assert.deepStrictEqual(st.llamadas[0], { ids: [1, 2], doc: '111111', correo: 'ana@pascualbravo.edu.co', estado: 'aceptado', motivo: null });
    await ctrl.responder({ ...id, ids: [3], motivo: ' horario ' }, 'rechazar');
    assert.strictEqual(st.llamadas[1].motivo, 'horario');
    await assert.rejects(ctrl.responder({ ...id, ids: [500] }, 'aceptar'), no(409));
    await assert.rejects(ctrl.responder({ ...id, ids: [] }, 'aceptar'), no(400));
    await assert.rejects(ctrl.responder({ ...id, ids: ['abc'] }, 'aceptar'), no(400));
    assert.strictEqual(st.logs.length, 2);
    assert.strictEqual(st.logs[0][2], 'ana@pascualbravo.edu.co');
    assert.strictEqual(st.logs[0][3], 'asignia_manage');
});

test('postular: usa el nombre conocido; si no hay, exige el que escribe el profesor', async () => {
    const { ctrl, st } = setup();
    await ctrl.postular({ documento: '111111', correo: 'ana@pascualbravo.edu.co', ids: [5], nombre: 'Otro' });
    assert.strictEqual(st.llamadas[0].nombre, 'ANA');
    await assert.rejects(ctrl.postular({ documento: '999999', correo: 'z@pascualbravo.edu.co', ids: [5] }), no(400));
    await ctrl.postular({ documento: '999999', correo: 'z@pascualbravo.edu.co', ids: [5], nombre: '  Zoe   Paz ' });
    assert.strictEqual(st.llamadas[1].nombre, 'Zoe Paz');
});
