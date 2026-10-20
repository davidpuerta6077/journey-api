const createController = require('../api/onix_reports/controller');

// BD falsa en memoria con lo mínimo que usa el controller.
function fakeDB(seed = {}) {
    const st = {
        users: { 'ana@x.co': 1, 'beto@x.co': 2, 'coord@x.co': 3, 'admin@x.co': 4, 'otra@x.co': 5 },
        permisos: { 'coord@x.co': ['onix_reports_area'], 'admin@x.co': ['onix_reports_admin'], 'otra@x.co': ['onix_reports_area'] },
        perfiles: { 1: { user_id: 1, nombre: 'Ana', identificacion: '1001', area_id: 10, area_nombre: 'Tec' }, 2: { user_id: 2, nombre: 'Beto', identificacion: '1002', area_id: 20 }, 3: { user_id: 3, nombre: 'Coord', identificacion: '1003', area_id: 10 } },
        areas: { 10: { id: 10, nombre: 'Tec', color: '#19445e' }, 20: { id: 20, nombre: 'Ped', color: '#5f3bd1' } },
        actividades: { 100: { id: 100, user_id: 1, nombre: 'Soporte', descripcion: 'Atender tickets', orden: 0 }, 200: { id: 200, user_id: 2, nombre: 'Clases', descripcion: 'Dictar', orden: 0 } },
        registros: { 1000: { id: 1000, actividad_id: 100, user_id: 1, mes: 10, anio: 2027, desarrollo: 'Atendí 30 tickets' } },
        evidencias: { 5000: { id: 5000, registro_id: 1000, tipo: 'imagen', contenido: '1/a.png', descripcion: 'Captura' }, 5001: { id: 5001, registro_id: 1000, tipo: 'link', contenido: 'https://x.co', descripcion: null } },
        logs: {
            700: { id: 700, date: new Date('2027-10-05T15:00:00Z'), username: 'ana@x.co', type: 'post', entity_type: 'sync_users', description: 'Sincronizó 3 usuarios con Moodle' },
            701: { id: 701, date: new Date('2027-10-02T15:00:00Z'), username: 'ANA@x.co', type: 'put', entity_type: 'course', description: 'Editó el curso "Programación Web"' },
            702: { id: 702, date: new Date('2027-10-03T15:00:00Z'), username: 'beto@x.co', type: 'post', entity_type: 'sync_users', description: 'Acción de Beto' },
        },
        registroLogs: {}, // log_id -> registro_id
        google: {}, // user_id -> { email, refresh_token }
        eventosUsados: {}, // evento_id -> { uid, registroId }
        seq: 9000,
        ...seed,
    };
    const next = () => ++st.seq;
    const db = {
        st,
        findPlatformUserByEmail: async (email) => (st.users[email] ? [{ id: st.users[email], email }] : []),
        getSettings: async (cat) => (st.settings || []).filter((r) => r.categoria === cat),
        checkSubmodulesPermissionsData: async (email, code) => [{ '?column?': (st.permisos[email] || []).includes(code) ? 1 : 0 }],
        onix: {
            getPerfil: async (id) => st.perfiles[id] || null,
            upsertPerfil: async (id, d) => (st.perfiles[id] = { user_id: id, ...d }),
            listAreas: async () => Object.values(st.areas),
            getArea: async (id) => st.areas[id] || null,
            insertArea: async (d) => { const id = next(); return (st.areas[id] = { id, ...d }); },
            updateArea: async (id, d) => (st.areas[id] = { id, ...d }),
            deleteArea: async (id) => { const a = st.areas[id] || null; delete st.areas[id]; return a; },
            listActividades: async (uid) => Object.values(st.actividades).filter((a) => a.user_id === uid),
            getActividad: async (id) => st.actividades[id] || null,
            insertActividad: async (uid, d) => { const id = next(); return (st.actividades[id] = { id, user_id: uid, ...d }); },
            updateActividad: async (id, d) => (st.actividades[id] = { ...st.actividades[id], ...d }),
            deleteActividad: async (id) => { const a = st.actividades[id]; delete st.actividades[id]; return a; },
            listImagenesDeActividad: async (aid) => Object.values(st.evidencias)
                .filter((e) => e.tipo === 'imagen' && st.registros[e.registro_id]?.actividad_id === aid)
                .map((e) => ({ contenido: e.contenido })),
            listRegistros: async (aid, mes, anio) => Object.values(st.registros).filter((r) => r.actividad_id === aid && r.mes === mes && r.anio === anio),
            getRegistro: async (id) => st.registros[id] || null,
            insertRegistro: async (d) => { const id = next(); return (st.registros[id] = { id, ...d }); },
            listRegistrosMes: async (uid, mes, anio) => Object.values(st.registros).filter((r) => r.user_id === uid && r.mes === mes && r.anio === anio),
            updateRegistro: async (id, d) => (st.registros[id] = {
                ...st.registros[id], desarrollo: d.desarrollo,
                titulo: d.titulo ?? st.registros[id].titulo, parrafo: d.parrafo ?? st.registros[id].parrafo,
            }),
            guardarGeneracion: async (id, d) => (st.registros[id] = { ...st.registros[id], ...d, generado_at: 'now' }),
            deleteRegistro: async (id) => { const r = st.registros[id]; delete st.registros[id]; return r; },
            listEvidenciasDeRegistros: async (ids) => Object.values(st.evidencias).filter((e) => ids.includes(e.registro_id)),
            getEvidencia: async (id) => (st.evidencias[id] ? { ...st.evidencias[id], user_id: st.registros[st.evidencias[id].registro_id]?.user_id } : null),
            insertEvidencia: async (d) => { const id = next(); return (st.evidencias[id] = { id, ...d }); },
            deleteEvidencia: async (id) => { const e = st.evidencias[id]; delete st.evidencias[id]; return e; },
            updateEvidenciaDescripcion: async (id, descripcion) => (st.evidencias[id] = { ...st.evidencias[id], descripcion }),
            listUsuariosConPerfil: async (areaId) => Object.values(st.perfiles).filter((p) => areaId === null || p.area_id === areaId),
            listLogsDisponibles: async (email, mes, anio) => Object.values(st.logs).filter((l) => l.username.toLowerCase() === email.toLowerCase()
                && !st.registroLogs[l.id] && l.date.getUTCMonth() + 1 === mes && l.date.getUTCFullYear() === anio),
            getLogsPorIds: async (ids) => ids.filter((id) => st.logs[id]).map((id) => ({ ...st.logs[id], usado: !!st.registroLogs[id] })),
            insertRegistroLogs: async (registroId, ids) => {
                if (ids.some((id) => st.registroLogs[id])) { const e = new Error('dup'); e.code = '23505'; throw e; }
                ids.forEach((id) => { st.registroLogs[id] = registroId; });
            },
            getGoogle: async (uid) => st.google[uid] || null,
            upsertGoogle: async (uid, email, refresh_token) => (st.google[uid] = { user_id: uid, email, refresh_token }),
            deleteGoogle: async (uid) => { const g = st.google[uid]; delete st.google[uid]; return g || null; },
            listEventosUsados: async (uid) => Object.keys(st.eventosUsados).filter((k) => st.eventosUsados[k].uid === uid),
            insertRegistroEventos: async (registroId, uid, ids) => {
                if (ids.some((id) => st.eventosUsados[id])) { const e = new Error('dup'); e.code = '23505'; throw e; }
                ids.forEach((id) => { st.eventosUsados[id] = { uid, registroId }; });
            },
        },
    };
    return db;
}

function fakeStorage() {
    const borrados = [];
    return {
        borrados,
        guardarImagen: async (uid, file) => `${uid}/nuevo.${file.mimetype === 'image/png' ? 'png' : 'jpg'}`,
        borrar: async (rel) => { borrados.push(rel); },
        leer: async (rel) => ({ datos: Buffer.from('img'), mime: rel.endsWith('.png') ? 'image/png' : 'image/jpeg' }),
    };
}

const eventosGoogle = [
    { id: 'ev1', titulo: 'Reunión de área', inicio: '2027-10-04T09:00:00-05:00', fin: '2027-10-04T10:30:00-05:00', todoElDia: false, duracionMin: 90, asistentes: 5 },
    { id: 'ev2', titulo: 'Capacitación Moodle', inicio: '2027-10-01', fin: '2027-10-02', todoElDia: true, duracionMin: null, asistentes: 0 },
];

const correosGoogle = [
    { id: 'h1', asunto: 'Cronograma de capacitación', para: ['Ana Pérez', 'bob@x.co', 'Carla', 'Dani'], mensajes: 3, fecha: '2027-10-02T15:00:00.000Z' },
    { id: 'h2', asunto: 'Solicitud de aulas', para: ['Soporte'], mensajes: 1, fecha: '2027-10-06T15:00:00.000Z' },
];

function setup(seed) {
    const db = fakeDB(seed);
    const storage = fakeStorage();
    const iaCalls = [];
    const respuestaIA = JSON.stringify({
        parrafo: 'Durante este periodo se atendieron los tickets de soporte de la plataforma.',
        titulo: 'Informe — Soporte',
        secciones: [{ titulo: 'Atención de tickets', texto: 'Se atendieron 30 tickets.', imagenes: [1] }],
    });
    const ia = { generarTexto: async (p) => { iaCalls.push(p); return { texto: respuestaIA, proveedor: 'ollama', modelo: 'qwen2.5:7b' }; } };
    const wordCalls = [];
    const word = {
        nombreMes: (m) => ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'][m - 1],
        documentoActividad: async (a) => { wordCalls.push(['actividad', a]); return Buffer.from('docx-actividad'); },
        documentoSubactividad: async (a) => { wordCalls.push(['subactividad', a]); return Buffer.from('docx-sub'); },
    };
    // Google y el cifrado falsos: el "cifrado" solo envuelve el texto.
    const googleCalls = [];
    const google = {
        configurado: () => true,
        urlAutorizacion: (uid) => `https://google/auth?state=${uid}`,
        leerEstado: (state) => (state === 'valido-1' ? 1 : null),
        canjearCodigo: async (code) => { googleCalls.push(['canjear', code]); return { refreshToken: 'rt-1', email: 'ana@gmail.com' }; },
        eventos: async (rt, desde, hasta) => { googleCalls.push(['eventos', rt, desde, hasta]); return eventosGoogle; },
        correosEnviados: async (rt, desde, hasta) => { googleCalls.push(['correos', rt, desde, hasta]); return correosGoogle; },
        revocar: async (rt) => { googleCalls.push(['revocar', rt]); },
    };
    const secreto = { cifrar: (t) => ({ c: t }), descifrar: (o) => o.c };
    const ctrl = createController(db, { ia, storage, word, google, secreto });
    return { db, storage, ia, iaCalls, word, wordCalls, google, googleCalls, ctrl };
}

const no = (status) => (e) => e.status === status;

module.exports = { setup, no };
