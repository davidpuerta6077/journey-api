const test = require('node:test');
const assert = require('node:assert');
const { DATASETS, catalogoPublico } = require('../services/reports/builder/catalogo');
const { aplicarFiltros } = require('../services/reports/builder/filtros');
const { calcularRiesgo, RIESGO_DEFECTO } = require('../services/reports/builder/riesgo');

// ─── Riesgo ──────────────────────────────────────────────────────────────────

test('riesgo: nunca entró, sin nota y 3 entregas vencidas = Alto; "Sin nota" no cuenta como nota baja', () => {
    const r = calcularRiesgo({
        m_en_moodle: true, m_matricula_en_moodle: true, m_nunca_entro_curso: true, m_dias_sin_entrar_curso: null,
        m_calificacion: 'Sin nota', m_entregas_vencidas: 3, m_avance: null,
    }, RIESGO_DEFECTO);
    assert.deepStrictEqual(r.criterios, ['Nunca entró al curso', 'Sin entrar > 7 días', 'Entregas vencidas > 2']);
    assert.strictEqual(r.nivel, 'Alto');
});

test('riesgo: criterio desactivado no cuenta y los cortes son configurables', () => {
    const fila = { m_en_moodle: true, m_matricula_en_moodle: true, m_nunca_entro_curso: false, m_dias_sin_entrar_curso: 10, m_calificacion: 2.5, m_entregas_vencidas: 0, m_avance: 80 };
    assert.strictEqual(calcularRiesgo(fila, RIESGO_DEFECTO).nivel, 'Medio');
    const sinNota = calcularRiesgo(fila, { criterios: { nota_baja: { activo: false } } });
    assert.deepStrictEqual(sinNota.criterios, ['Sin entrar > 7 días']);
    assert.strictEqual(sinNota.nivel, 'Bajo');
    assert.strictEqual(calcularRiesgo(fila, { cortes: { alto: 2 } }).nivel, 'Alto');
    assert.strictEqual(calcularRiesgo({ ...fila, m_dias_sin_entrar_curso: 1, m_calificacion: 4 }, RIESGO_DEFECTO).nivel, 'Sin riesgo');
});

test('riesgo: quien no está en Moodle cuenta como nunca entró', () => {
    const r = calcularRiesgo({ m_en_moodle: false, m_matricula_en_moodle: false, m_nunca_entro_curso: null }, RIESGO_DEFECTO);
    assert.ok(r.criterios.includes('Nunca entró al curso'));
    assert.strictEqual(r.nivel, 'Medio');
});

// ─── Filtros ─────────────────────────────────────────────────────────────────

const filas = [
    { a: 'Matriculado', n: 5, f: '2026-10-01 08:00', p: '20261', b: true },
    { a: 'Cancelado', n: 12, f: '2026-10-15 10:30', p: '20262', b: false },
    { a: 'Matrícula Activa', n: null, f: null, p: '20262', b: null },
];
const quedan = (filtros) => aplicarFiltros(filas, filtros).map((r) => r.a);

test('filtros: cada operador', () => {
    assert.deepStrictEqual(quedan([{ col: 'a', op: 'eq', valor: 'matriculado' }]), ['Matriculado']);
    assert.deepStrictEqual(quedan([{ col: 'a', op: 'neq', valor: 'Cancelado' }]), ['Matriculado', 'Matrícula Activa']);
    assert.deepStrictEqual(quedan([{ col: 'a', op: 'contains', valor: 'matricula' }]), ['Matriculado', 'Matrícula Activa']);
    assert.deepStrictEqual(quedan([{ col: 'a', op: 'in', valor: ['Cancelado', 'Matriculado'] }]), ['Matriculado', 'Cancelado']);
    assert.deepStrictEqual(quedan([{ col: 'n', op: 'empty' }]), ['Matrícula Activa']);
    assert.deepStrictEqual(quedan([{ col: 'n', op: 'not_empty' }]), ['Matriculado', 'Cancelado']);
    assert.deepStrictEqual(quedan([{ col: 'n', op: 'gt', valor: '7' }]), ['Cancelado']);
    assert.deepStrictEqual(quedan([{ col: 'n', op: 'lt', valor: 7 }]), ['Matriculado']);
    assert.deepStrictEqual(quedan([{ col: 'f', op: 'between', valor: ['2026-10-01', '2026-10-01'] }]), ['Matriculado']);
    assert.deepStrictEqual(quedan([{ col: 'f', op: 'between', valor: ['2026-10-02', ''] }]), ['Cancelado']);
    assert.deepStrictEqual(quedan([{ col: 'b', op: 'eq', valor: true }]), ['Matriculado']);
    assert.deepStrictEqual(quedan([{ col: 'b', op: 'eq', valor: 'false' }]), ['Cancelado']);
});

test('filtros: periodo_actual se queda con el mayor; sin periodos no filtra', () => {
    assert.deepStrictEqual(quedan([{ col: 'p', op: 'periodo_actual' }]), ['Cancelado', 'Matrícula Activa']);
    assert.strictEqual(aplicarFiltros([{ p: null }, { p: '' }], [{ col: 'p', op: 'periodo_actual' }]).length, 2);
});

// ─── Catálogo ────────────────────────────────────────────────────────────────

test('catálogo: ninguna contraseña es seleccionable y el público no expone SQL', () => {
    for (const ds of Object.values(DATASETS)) {
        for (const c of ds.columnas) {
            assert.ok(!/password/i.test(c.key + (c.expr || '')), `${c.key} expone contraseña`);
        }
    }
    const pub = JSON.stringify(catalogoPublico());
    assert.ok(!/expr|"from"|claves/.test(pub));
    assert.ok(catalogoPublico().find((d) => d.key === 'matriculas').columnas.some((c) => c.grupo === 'Riesgo'));
});

// ─── Ejecución (BD y Moodle falsos) ──────────────────────────────────────────

const { runConstructor } = require('../services/reports/builder');

const filasNexo = [
    { u_nombre_completo: 'Ana Pérez', e_estado: 'Matriculado', e_role: 'Estudiante', _username: 'ana', _documento: '111', _curso_idnumber: 'C1', _curso_shortname: 'c1' },
    { u_nombre_completo: 'Luis Gómez', e_estado: 'Matriculado', e_role: 'Estudiante', _username: 'luis', _documento: '222', _curso_idnumber: 'C1', _curso_shortname: 'c1' },
    { u_nombre_completo: 'Eva Ruiz', e_estado: 'Cancelado', e_role: 'Estudiante', _username: 'eva', _documento: '333', _curso_idnumber: 'C1', _curso_shortname: 'c1' },
];
const ahora = Math.floor(Date.now() / 1000);

// Moodle: ana existe, entró al curso hace 10 días, nota 35/50; luis no existe.
function fakeMysql(log) {
    return async (text, values) => {
        log.push([text, values]);
        if (/FROM mdl_user\b/.test(text)) return [{ id: 7, username: 'ana', idnumber: '111', lastaccess: ahora - 86400 }];
        if (/FROM mdl_course\b/.test(text)) return [{ id: 70, idnumber: 'C1', shortname: 'c1' }];
        if (/mdl_user_enrolments/.test(text)) return [{ userid: 7, courseid: 70 }];
        if (/mdl_user_lastaccess/.test(text)) return [{ userid: 7, courseid: 70, timeaccess: ahora - 10 * 86400 }];
        if (/mdl_grade_grades/.test(text)) return [{ courseid: 70, userid: 7, finalgrade: 35, grademax: 50 }];
        if (/COUNT\(\*\) AS total/.test(text)) return [{ course: 70, total: 4 }];
        if (/mdl_course_modules_completion/.test(text)) return [{ course: 70, userid: 7, hechas: 1 }];
        if (/FROM mdl_assign a/.test(text)) return [{ id: 1, course: 70 }, { id: 2, course: 70 }, { id: 3, course: 70 }];
        if (/mdl_assign_submission/.test(text)) return [];
        return [];
    };
}

const deps = (extra = {}) => {
    const log = [];
    return { log, query: async () => filasNexo.map((r) => ({ ...r })), mysql: fakeMysql(log), rest: async () => null, ...extra };
};

test('constructor: dataset o filtro desconocido = 400; columna desconocida se ignora', async () => {
    await assert.rejects(runConstructor({ dataset: 'nope' }, deps()), (e) => e.status === 400);
    await assert.rejects(runConstructor({ dataset: 'matriculas', filtros: [{ col: 'u_password', op: 'eq', valor: 'x' }] }, deps()), (e) => e.status === 400);
    await assert.rejects(runConstructor({ dataset: 'matriculas', filtros: [{ col: 'e_estado', op: 'drop', valor: 'x' }] }, deps()), (e) => e.status === 400);
    const r = await runConstructor({ dataset: 'matriculas', columnas: ['u_nombre_completo', 'u_password'] }, deps());
    assert.deepStrictEqual(r.columns.map((c) => c.key), ['u_nombre_completo']);
    assert.deepStrictEqual(Object.keys(r.rows[0]), ['u_nombre_completo']);
});

test('constructor: solo las filas que pasan los filtros de Nexo van a Moodle', async () => {
    const d = deps();
    await runConstructor({ dataset: 'matriculas', columnas: ['u_nombre_completo', 'm_calificacion'], filtros: [{ col: 'e_estado', op: 'eq', valor: 'Matriculado' }] }, d);
    const [, values] = d.log.find(([t]) => /FROM mdl_user\b/.test(t));
    assert.deepStrictEqual(values[0], ['ana', 'luis']);
});

test('constructor: columnas de Moodle y riesgo', async () => {
    const r = await runConstructor({
        dataset: 'matriculas',
        columnas: ['u_nombre_completo', 'm_en_moodle', 'm_nunca_entro_curso', 'm_dias_sin_entrar_curso', 'm_calificacion', 'm_avance', 'm_entregas_vencidas', 'riesgo_nivel', 'riesgo_criterios'],
        filtros: [{ col: 'e_estado', op: 'eq', valor: 'Matriculado' }],
    }, deps());
    const [ana, luis] = r.rows;
    assert.strictEqual(ana.m_calificacion, 3.5);
    assert.strictEqual(ana.m_avance, 25);
    assert.strictEqual(ana.m_entregas_vencidas, 3);
    assert.strictEqual(ana.m_dias_sin_entrar_curso, 10);
    assert.strictEqual(ana.riesgo_nivel, 'Alto'); // sin acceso > 7, vencidas > 2, avance < 50
    assert.strictEqual(luis.m_en_moodle, false);
    assert.strictEqual(luis.m_nunca_entro_curso, null);
    assert.match(luis.riesgo_criterios, /Nunca entró al curso/);
    assert.deepStrictEqual(r.meta.avisos, []);
});

test('constructor: filtro sobre columna de riesgo se aplica después de calcularla', async () => {
    const r = await runConstructor({
        dataset: 'matriculas', columnas: ['u_nombre_completo'],
        filtros: [{ col: 'e_estado', op: 'eq', valor: 'Matriculado' }, { col: 'm_en_moodle', op: 'eq', valor: false }],
    }, deps());
    assert.deepStrictEqual(r.rows.map((x) => x.u_nombre_completo), ['Luis Gómez']);
});

test('constructor: sin calificación = "Sin nota"; Moodle caído usa REST con aviso', async () => {
    const d = deps({
        mysql: async () => { const e = new Error('connect ETIMEDOUT'); e.code = 'ETIMEDOUT'; throw e; },
        rest: async (fn, p) => {
            if (fn === 'core_course_get_courses_by_field') return { courses: [{ id: 70, idnumber: p.value, shortname: 'c1' }] };
            if (fn === 'core_enrol_get_enrolled_users') return [{ id: 7, username: 'ana', idnumber: '111', lastaccess: ahora - 3600, lastcourseaccess: 0 }];
            if (fn === 'core_user_get_users_by_field') return [{ id: 7, username: 'ana', idnumber: '111', lastaccess: ahora - 3600 }];
            return null;
        },
    });
    const r = await runConstructor({ dataset: 'matriculas', columnas: ['u_nombre_completo', 'm_nunca_entro_curso', 'm_calificacion'] }, d);
    assert.strictEqual(r.meta.avisos.length, 1);
    assert.strictEqual(r.rows[0].m_nunca_entro_curso, true);
    assert.strictEqual(r.rows[0].m_calificacion, null);

    const sinNota = deps();
    sinNota.mysql = async (t, v) => (/mdl_grade_grades/.test(t) ? [{ courseid: 70, userid: 7, finalgrade: null, grademax: 50 }] : fakeMysql([])(t, v));
    const r2 = await runConstructor({ dataset: 'matriculas', columnas: ['m_calificacion'] }, sinNota);
    assert.strictEqual(r2.rows[0].m_calificacion, 'Sin nota');
});
