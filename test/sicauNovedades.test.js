const test = require('node:test');
const assert = require('node:assert');
const createSicauCtrl = require('../api/SICAU/controller');

// BD falsa: registra cada llamada para poder verificar qué se escribió.
const fakeDB = (overrides = {}) => {
    const calls = [];
    const record = (name, ret) => async (...args) => { calls.push([name, ...args]); return ret; };
    const db = {
        findEnrollmentsByCodigoJourney: record('findEnrollmentsByCodigoJourney', [
            { id: 1, estado: 'Matriculado' },
            { id: 2, estado: 'Activa' },
            { id: 3, estado: 'Cancelado' },
        ]),
        updateEnrollmentEstado: record('updateEnrollmentEstado'),
        updateEnrollmentEstadoSync: record('updateEnrollmentEstadoSync'),
        updateEnrollmentSyncStatus: record('updateEnrollmentSyncStatus'),
        insertSicauNovedad: record('insertSicauNovedad'),
        findUserByDoc: record('findUserByDoc', []),
        findCourseSicau: record('findCourseSicau', []),
        insertCourse: record('insertCourse', [{ id: 99 }]),
        ...overrides,
    };
    return { db, calls };
};

const cursoRetiro = {
    codigo_asignatura: 'FB0010', nombre_asignatura: 'Base de Datos II', periodo: '20261', grupo: '101',
    novedad: { tipo: 'RETIRO', motivo: 'NO_REQUIERE_CURSO_VIRTUAL', cambios: [] },
};

test('RETIRO de curso desmatricula solo las matrículas activas y no toca el curso', async () => {
    const { db, calls } = fakeDB();
    const result = await createSicauCtrl(db).saveSicauCursoYMatriculas({ course: cursoRetiro, enrollments: [] }, 'jor.ramirez');

    assert.deepStrictEqual(calls.find(c => c[0] === 'findEnrollmentsByCodigoJourney'), ['findEnrollmentsByCodigoJourney', 'FB001020261G101']);
    const desmatriculadas = calls.filter(c => c[0] === 'updateEnrollmentEstado');
    assert.deepStrictEqual(desmatriculadas, [['updateEnrollmentEstado', 1, 'Desmatriculado'], ['updateEnrollmentEstado', 2, 'Desmatriculado']]);
    assert.ok(calls.some(c => c[0] === 'updateEnrollmentEstadoSync' && c[1] === 1 && c[2] === 'pendiente'));
    assert.ok(calls.some(c => c[0] === 'updateEnrollmentSyncStatus' && c[1] === 2 && c[2] === false));
    assert.ok(!calls.some(c => c[0] === 'insertCourse' || c[0] === 'findCourseSicau'), 'el curso no se crea ni se actualiza');
    assert.strictEqual(result.course.status, 'retiro');
    assert.strictEqual(result.course.desmatriculadas, 2);
});

test('RETIRO de curso queda registrado como novedad SICAU con motivo y usuario', async () => {
    const { db, calls } = fakeDB();
    await createSicauCtrl(db).saveSicauCursoYMatriculas({ course: cursoRetiro, enrollments: [] }, 'jor.ramirez');

    const [, row] = calls.find(c => c[0] === 'insertSicauNovedad');
    assert.strictEqual(row.nivel, 'curso');
    assert.strictEqual(row.tipo, 'RETIRO');
    assert.strictEqual(row.motivo, 'NO_REQUIERE_CURSO_VIRTUAL');
    assert.strictEqual(row.codigo_journey, 'FB001020261G101');
    assert.strictEqual(row.usuario_sicau, 'jor.ramirez');
    assert.match(row.resultado, /2 matrícula/);
});

test('novedad de matrícula (cambio de grupo) queda registrada con cédula y cambios', async () => {
    const { db, calls } = fakeDB();
    const cambios = [{ campo: 'grupo', anterior: 'G101', actual: 'G102' }];
    await createSicauCtrl(db).saveSicauMatricula({
        cedula: '1111111124', role: 'ESTUDIANTE', codigo_asignatura: 'FB0010', periodo: '20261', grupo: 'G102', estado: 'Activa',
        novedad: { tipo: 'CAMBIO_DE_GRUPO', cambios },
    }, 'jor.ramirez');

    const [, row] = calls.find(c => c[0] === 'insertSicauNovedad');
    assert.strictEqual(row.nivel, 'matricula');
    assert.strictEqual(row.tipo, 'CAMBIO_DE_GRUPO');
    assert.strictEqual(row.cedula, '1111111124');
    assert.strictEqual(row.codigo_journey, 'FB001020261G102');
    assert.deepStrictEqual(row.cambios, cambios);
    assert.strictEqual(row.usuario_sicau, 'jor.ramirez');
});

test('matrícula sin novedad no registra nada', async () => {
    const { db, calls } = fakeDB();
    await createSicauCtrl(db).saveSicauMatricula({ cedula: '1', codigo_asignatura: 'FB0010', periodo: '20261', grupo: '101', estado: 'Activa' });
    assert.ok(!calls.some(c => c[0] === 'insertSicauNovedad'));
});

test('RETIRO de curso enviado directo a saveSicauCurso (sin pasar por el endpoint unificado) también se retira', async () => {
    const { db, calls } = fakeDB();
    const result = await createSicauCtrl(db).saveSicauCurso(cursoRetiro);

    assert.strictEqual(result.status, 'retiro');
    assert.ok(!calls.some(c => c[0] === 'findCourseSicau'), 'no debe tratarse como curso normal');
    assert.ok(calls.some(c => c[0] === 'insertSicauNovedad'));
});

test('cambio de profesor en un curso existente queda registrado como novedad', async () => {
    const cursoExistente = {
        id: 5, moodle_id: 10, nombre_profesor: 'Johana Ramirez', nombre_asignatura: 'Base de Datos II',
        fecha_inicio: '2026-01-15', fecha_fin: '2026-06-15',
    };
    const { db, calls } = fakeDB({ findCourseSicau: async () => [cursoExistente], updateCourseFromSicau: async () => [] });
    await createSicauCtrl(db).saveSicauCurso({
        codigo_asignatura: 'FB0010', nombre_asignatura: 'Base de Datos II', periodo: '20261', grupo: '101',
        nombre_profesor: 'Carlos Gomez', fecha_inicio: '2026-01-15', fecha_fin: '2026-06-15',
    });

    const [, row] = calls.find(c => c[0] === 'insertSicauNovedad');
    assert.strictEqual(row.nivel, 'curso');
    assert.strictEqual(row.tipo, 'CAMBIO_DE_PROFESOR');
    assert.deepStrictEqual(row.cambios, [{ campo: 'nombre_profesor', anterior: 'Johana Ramirez', actual: 'Carlos Gomez' }]);
});

test('cambio de fechas en un curso existente queda registrado como novedad', async () => {
    const cursoExistente = {
        id: 5, moodle_id: 10, nombre_profesor: 'Johana Ramirez', nombre_asignatura: 'Base de Datos II',
        fecha_inicio: '2026-01-15', fecha_fin: '2026-06-15',
    };
    const { db, calls } = fakeDB({ findCourseSicau: async () => [cursoExistente], updateCourseFromSicau: async () => [] });
    await createSicauCtrl(db).saveSicauCurso({
        codigo_asignatura: 'FB0010', nombre_asignatura: 'Base de Datos II', periodo: '20261', grupo: '101',
        nombre_profesor: 'Johana Ramirez', fecha_inicio: '2026-01-20', fecha_fin: '2026-06-20',
    });

    const novedadesFechas = calls.filter(c => c[0] === 'insertSicauNovedad').map(c => c[1]);
    const row = novedadesFechas.find(n => n.tipo === 'CAMBIO_DE_FECHAS');
    assert.ok(row, 'debe registrar CAMBIO_DE_FECHAS');
    assert.deepStrictEqual(row.cambios, [
        { campo: 'fecha_inicio', anterior: '2026-01-15', actual: '2026-01-20' },
        { campo: 'fecha_fin', anterior: '2026-06-15', actual: '2026-06-20' },
    ]);
});

test('si falla el registro de la novedad, la ingesta sigue', async () => {
    const { db } = fakeDB({ insertSicauNovedad: async () => { throw new Error('tabla no existe'); } });
    const original = console.error; console.error = () => {};
    try {
        const result = await createSicauCtrl(db).saveSicauCursoYMatriculas({ course: cursoRetiro, enrollments: [] }, 'x');
        assert.strictEqual(result.course.status, 'retiro');
    } finally { console.error = original; }
});
