const { statisticsQueries: Q } = require('../../database/querysets');

// Administrador > Estadísticas. Una respuesta por aplicación con la misma forma
// para que el front la dibuje sin saber de qué app se trata:
// { app, dias, kpis: [{ label, valor, anterior?, icono, tono?, nota? }],
//   graficos: [ { tipo: 'linea', titulo, dias: [...], series: [{ nombre, valores }] }
//             | { tipo: 'categorias', titulo, data: [{ nombre, valor }] }        (dona o barras)
//             | { tipo: 'mosaico', titulo, data: [{ nombre, valor }] }           (treemap)
//             | { tipo: 'columnas', titulo, categorias: [...], series: [{ nombre, valores }] }
//             | { tipo: 'calor', titulo, celdas: [7 días][24 horas] }           (lunes primero)
//             | { tipo: 'medidor', titulo, valor: 0-100, detalle } ],
//   listas: [{ titulo, items: [{ principal, secundario, valor, fecha }] }] }
const APPS = ['general', 'nexo', 'onix', 'acudex', 'atom', 'codex'];
const PERIODOS = [7, 30, 90, 180, 365];

const NOMBRE_APP = {
    nexo_sync: 'Nexo', onix_reports: 'Onix-IA', attendance_forms: 'Acudex', codex: 'C0deX',
    atom: 'Atom', admin: 'Administrador', otros: 'Otros',
};
const ACCION = {
    post: 'Creaciones', put: 'Ediciones', delete: 'Eliminaciones', get: 'Consultas',
    sync_error_course: 'Errores al sincronizar cursos', sync_error_enrollment: 'Errores al sincronizar matrículas',
};
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const n = (v) => Number(v || 0).toLocaleString('es-CO');
const NIVEL = { matricula: 'Matrículas', usuario: 'Usuarios', curso: 'Cursos' };
const legible = (s) => {
    const t = String(s ?? '').replace(/_/g, ' ').toLowerCase();
    return t.charAt(0).toUpperCase() + t.slice(1);
};

// Días del periodo (zona Bogotá), del más viejo a hoy, para que las líneas no tengan huecos.
function diasDelPeriodo(dias) {
    const hoy = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Bogota' }));
    return Array.from({ length: dias }, (_, i) => {
        const d = new Date(hoy);
        d.setDate(hoy.getDate() - (dias - 1 - i));
        return d.toLocaleDateString('en-CA');
    });
}

// filas [{ dia, serie, n }] -> gráfico de líneas, una serie por valor de `serie`.
function linea(titulo, filas, dias, nombreSerie = (s) => s) {
    const eje = diasDelPeriodo(dias);
    const series = new Map();
    for (const f of filas) {
        const nombre = nombreSerie(f.serie);
        if (!series.has(nombre)) series.set(nombre, new Map());
        const m = series.get(nombre);
        m.set(f.dia, (m.get(f.dia) || 0) + f.n);
    }
    return {
        tipo: 'linea', titulo, dias: eje,
        series: [...series.entries()].map(([nombre, m]) => ({ nombre, valores: eje.map((d) => m.get(d) || 0) })),
    };
}
const categorias = (titulo, filas, nombre = (f) => f.nombre, tipo = 'categorias') => ({
    tipo, titulo, data: filas.map((f) => ({ nombre: nombre(f), valor: f.n })),
});
// filas [{ dow 1-7, hora 0-23, n }] -> matriz 7 × 24 (lunes primero).
function calor(titulo, filas) {
    const celdas = Array.from({ length: 7 }, () => Array(24).fill(0));
    for (const f of filas) celdas[f.dow - 1][f.hora] += f.n;
    return { tipo: 'calor', titulo, celdas };
}
const medidor = (titulo, parte, total, que) => ({
    tipo: 'medidor', titulo,
    valor: total ? Math.round((parte / total) * 100) : null,
    detalle: total ? `${n(parte)} de ${n(total)} ${que}` : `Sin ${que}`,
});
// filas [{ <clave>, serie, n }] -> columnas agrupadas por `clave`, en el orden de `categorias`.
function columnas(titulo, categoriasEje, filas, clave, etiqueta = (c) => c) {
    const series = [...new Set(filas.map((f) => f.serie))];
    return {
        tipo: 'columnas', titulo, categorias: categoriasEje.map(etiqueta),
        series: series.map((s) => ({
            nombre: s,
            valores: categoriasEje.map((c) => filas.filter((f) => f.serie === s && f[clave] === c).reduce((a, f) => a + f.n, 0)),
        })),
    };
}
const nombreAccion = (f) => ACCION[f.nombre] || legible(f.nombre);

module.exports = (injectedDB) => {
    let data = injectedDB;
    if (!data) data = require('../../database/postgresql');
    const q = (query) => data.query(query);
    const uno = async (query) => (await q(query))[0] || {};

    const porApp = {
        async general(dias) {
            const [r, porDia, top, ultimos, horas, acciones] = await Promise.all([
                uno(Q.general.resumen(dias)), q(Q.general.porDiaYApp(dias)), q(Q.general.topUsuarios(dias)), q(Q.general.ultimos()),
                q(Q.general.calor(dias)), q(Q.general.tiposAccion(dias)),
            ]);
            const totalApp = new Map();
            for (const f of porDia) totalApp.set(f.app, (totalApp.get(f.app) || 0) + f.n);
            const uso = [...totalApp.entries()].sort((a, b) => b[1] - a[1]);
            const [masUsada] = uso;
            return {
                kpis: [
                    { label: 'Usuarios activos', valor: r.usuarios, anterior: r.usuarios_ant, icono: 'usuarios', nota: `de ${n(r.usuarios_hub)} con acceso a Bravo Hub` },
                    { label: 'Acciones registradas', valor: r.acciones, anterior: r.acciones_ant, icono: 'actividad' },
                    { label: 'Aplicación más usada', valor: masUsada ? NOMBRE_APP[masUsada[0]] || masUsada[0] : '—', icono: 'app',
                        nota: masUsada ? `${Math.round((masUsada[1] / (r.acciones || 1)) * 100)} % de la actividad` : 'Sin actividad' },
                    { label: 'Usuarios de Bravo Hub', valor: r.usuarios_hub, icono: 'equipo' },
                ],
                graficos: [
                    linea('Actividad por día y aplicación', porDia.map((f) => ({ ...f, serie: f.app })), dias, (a) => NOMBRE_APP[a] || a),
                    { tipo: 'categorias', titulo: 'Uso por aplicación', data: uso.map(([app, v]) => ({ nombre: NOMBRE_APP[app] || app, valor: v })) },
                    medidor('Equipo que usó Bravo Hub', r.usuarios, r.usuarios_hub, 'usuarios con acceso'),
                    calor('¿Cuándo se trabaja? Acciones por día y hora', horas),
                    categorias('Qué se hizo', acciones, nombreAccion),
                ],
                listas: [
                    { titulo: 'Usuarios más activos', items: top.map((f) => ({ principal: f.usuario, secundario: `Más en ${NOMBRE_APP[f.app] || f.app}`, valor: f.n })) },
                    { titulo: 'Últimos movimientos', items: ultimos.map((f) => ({ principal: f.descripcion || '—', secundario: `${f.usuario || '—'} · ${NOMBRE_APP[f.app] || f.app}`, fecha: f.fecha })) },
                ],
            };
        },

        async nexo(dias) {
            const [c, nov, porDia, porTipo, programa, sync, asignaturas, horas, jornada, porAsignatura] = await Promise.all([
                uno(Q.nexo.conteos()), uno(Q.nexo.novedades(dias)), q(Q.nexo.novedadesPorDia(dias)), q(Q.nexo.novedadesPorTipo(dias)),
                q(Q.nexo.porPrograma()), q(Q.nexo.estadoSync()), q(Q.nexo.topAsignaturas()), q(Q.nexo.calorNovedades(dias)),
                q(Q.nexo.porJornada()), q(Q.nexo.porAsignatura()),
            ]);
            return {
                kpis: [
                    { label: 'Estudiantes y profesores', valor: c.usuarios, icono: 'usuarios' },
                    { label: 'Cursos', valor: c.cursos, icono: 'cursos', nota: c.cursos_error ? `${n(c.cursos_error)} con error de sincronización` : 'Sin errores de sincronización', tono: c.cursos_error ? 'alerta' : undefined },
                    { label: 'Matrículas vigentes', valor: c.matriculas, icono: 'matriculas', nota: `${n(c.sin_sincronizar)} sin sincronizar a Moodle`, tono: c.sin_sincronizar ? 'aviso' : undefined },
                    { label: 'Novedades de SICAU', valor: nov.n, anterior: nov.n_ant, icono: 'novedades' },
                ],
                graficos: [
                    linea('Novedades de SICAU por día', porDia, dias, (v) => NIVEL[v] || legible(v)),
                    medidor('Matrículas sincronizadas a Moodle', c.matriculas - c.sin_sincronizar, c.matriculas, 'matrículas vigentes'),
                    categorias('Estudiantes por jornada', jornada),
                    categorias('Estudiantes por programa', programa),
                    categorias('Novedades por tipo', porTipo, (f) => `${NIVEL[f.nivel] || legible(f.nivel)} · ${legible(f.tipo)}`),
                    categorias('Estudiantes por asignatura', porAsignatura, undefined, 'mosaico'),
                    calor('¿Cuándo llegan las novedades de SICAU?', horas),
                    categorias('Sincronización de matrículas', sync, (f) => legible(f.nombre)),
                ],
                listas: [
                    { titulo: 'Asignaturas con más estudiantes', items: asignaturas.map((f) => ({ principal: f.nombre, secundario: `${f.grupos} ${f.grupos === 1 ? 'grupo' : 'grupos'}`, valor: f.n })) },
                ],
            };
        },

        async onix(dias) {
            const [c, porDia, area, actividades, usuarios, personas, meses] = await Promise.all([
                uno(Q.onix.conteos(dias)), q(Q.onix.registrosPorDia(dias)), q(Q.onix.porArea(dias)), q(Q.onix.topActividades(dias)),
                q(Q.onix.topUsuarios(dias)), uno(Q.onix.personasQueRegistran(dias)), q(Q.onix.porMes()),
            ]);
            const mesesAsc = [...meses].reverse();
            return {
                kpis: [
                    { label: 'Registros de actividades', valor: c.registros, anterior: c.registros_ant, icono: 'actividad' },
                    { label: 'Informes generados', valor: c.informes, icono: 'informes', nota: `${n(c.informes_periodo)} en el periodo` },
                    { label: 'Personas con perfil', valor: c.perfiles, icono: 'usuarios' },
                    { label: 'Evidencias subidas', valor: c.evidencias, icono: 'archivos', nota: 'en el periodo' },
                ],
                graficos: [
                    linea('Registros por día', porDia, dias),
                    medidor('Personas que registraron', personas.n, c.perfiles, 'personas con perfil'),
                    categorias('Registros por área', area),
                    {
                        tipo: 'columnas', titulo: 'Registros por mes del informe',
                        categorias: mesesAsc.map((m) => `${MESES[m.mes - 1]} ${m.anio}`),
                        series: [{ nombre: 'Registros', valores: mesesAsc.map((m) => m.n) }],
                    },
                    categorias('Actividades más registradas', actividades),
                ],
                listas: [
                    { titulo: 'Quiénes más registran', items: usuarios.map((f) => ({ principal: f.usuario, valor: f.n })) },
                ],
            };
        },

        async acudex(dias) {
            const [c, porDia, formularios, modalidad, proximos, horas] = await Promise.all([
                uno(Q.acudex.conteos(dias)), q(Q.acudex.respuestasPorDia(dias)), q(Q.acudex.porFormulario()), q(Q.acudex.porModalidad()),
                q(Q.acudex.proximos()), q(Q.acudex.calor(dias)),
            ]);
            return {
                kpis: [
                    { label: 'Formularios', valor: c.formularios, icono: 'formularios', nota: `${n(c.publicados)} publicados` },
                    { label: 'Asistencias registradas', valor: c.respuestas, anterior: c.respuestas_ant, icono: 'asistencia' },
                    { label: 'Asistencias en total', valor: c.respuestas_total, icono: 'usuarios' },
                    { label: 'Promedio por formulario', valor: c.formularios ? Math.round((c.respuestas_total / c.formularios) * 10) / 10 : 0, icono: 'actividad' },
                ],
                graficos: [
                    linea('Asistencias por día', porDia, dias),
                    medidor('Formularios publicados', c.publicados, c.formularios, 'formularios'),
                    categorias('Formularios por modalidad', modalidad, (f) => legible(f.nombre)),
                    categorias('Asistencias por formulario', formularios, undefined, 'mosaico'),
                    calor('¿Cuándo se registra la asistencia?', horas),
                ],
                listas: [
                    { titulo: 'Próximos eventos', items: proximos.map((f) => ({ principal: f.nombre, secundario: [f.lugar, f.fecha && new Date(f.fecha).toLocaleDateString('es-CO', { timeZone: 'UTC' })].filter(Boolean).join(' · '), valor: f.n })) },
                ],
            };
        },

        async atom(dias) {
            const [c, estado, prioridad, carga, porDia, semanas] = await Promise.all([
                uno(Q.atom.conteos(dias)), q(Q.atom.porEstado()), q(Q.atom.porPrioridad()), q(Q.atom.cargaPorPersona()),
                q(Q.atom.completadasPorDia(dias)), q(Q.atom.porSemana(dias)),
            ]);
            const ejeSemanas = [...new Set(semanas.map((f) => f.semana))].sort();
            const etiquetaSemana = (s) => `Sem. ${new Date(`${s}T12:00:00`).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}`;
            return {
                kpis: [
                    { label: 'Tareas abiertas', valor: c.abiertas, icono: 'tareas' },
                    { label: 'Vencidas', valor: c.vencidas, icono: 'alerta', tono: c.vencidas ? 'alerta' : undefined },
                    { label: 'Completadas', valor: c.completadas, anterior: c.completadas_ant, icono: 'completadas' },
                    { label: 'Completadas a tiempo', valor: c.con_fecha ? `${Math.round((c.a_tiempo / c.con_fecha) * 100)} %` : '—', icono: 'reloj',
                        nota: c.con_fecha ? `${n(c.a_tiempo)} de ${n(c.con_fecha)} con fecha límite` : 'Sin tareas con fecha límite' },
                ],
                graficos: [
                    linea('Tareas completadas por día', porDia, dias),
                    medidor('Completadas a tiempo', c.a_tiempo, c.con_fecha, 'tareas con fecha límite'),
                    categorias('Tareas por estado', estado),
                    columnas('Creadas vs completadas por semana', ejeSemanas, semanas, 'semana', etiquetaSemana),
                    categorias('Abiertas por prioridad', prioridad),
                    categorias('Tareas abiertas por persona', carga),
                ],
                listas: [],
            };
        },

        async codex(dias) {
            const [c, autores, porDia, ultimas, acciones] = await Promise.all([
                uno(Q.codex.conteos(dias)), q(Q.codex.porAutor()), q(Q.codex.actividadPorDia(dias)), q(Q.codex.ultimas()), q(Q.codex.tiposAccion(dias)),
            ]);
            return {
                kpis: [
                    { label: 'Páginas', valor: c.paginas, icono: 'paginas' },
                    { label: 'Creadas', valor: c.creadas, anterior: c.creadas_ant, icono: 'nuevas' },
                    { label: 'Editadas', valor: c.editadas, icono: 'actividad', nota: 'en el periodo' },
                    { label: 'Autores', valor: c.autores, icono: 'usuarios' },
                ],
                graficos: [
                    linea('Acciones en C0deX por día', porDia, dias),
                    categorias('Qué se hizo', acciones, nombreAccion),
                    categorias('Páginas por autor', autores),
                ],
                listas: [
                    { titulo: 'Últimas páginas editadas', items: ultimas.map((f) => ({ principal: f.nombre, secundario: f.usuario || '—', fecha: f.fecha })) },
                ],
            };
        },
    };

    async function estadisticas(app = 'general', diasParam = 30) {
        const dias = Number(diasParam);
        if (!APPS.includes(app) || !PERIODOS.includes(dias)) {
            const err = new Error(`app debe ser ${APPS.join(', ')} y dias ${PERIODOS.join(', ')}`);
            err.status = 400;
            throw err;
        }
        return { app, dias, ...(await porApp[app](dias)) };
    }

    return { estadisticas, APPS, PERIODOS };
};
