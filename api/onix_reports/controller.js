// Módulo Informes (Onix-IA). Reglas de acceso:
//  - dueño (onix_reports_use): lee y escribe lo suyo;
//  - onix_reports_area: lee lo de usuarios de su misma área (según su perfil);
//  - onix_reports_admin: lee todo y administra áreas.
// Nadie escribe datos de otro usuario. Lo ajeno o inexistente responde 404.

const JSZip = require('jszip');
const { tituloDe, nombreArchivo } = require('../../services/onix/titulo');
const { leerPromptInformes } = require('../../services/ia/config');

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

// Las reglas de redacción se editan en Configuración > Inteligencia artificial
// (services/ia/config.js). El formato de salida es fijo: parsearGeneracion depende de él.
const FORMATO_SALIDA = [
    'Formato de salida: responde únicamente con un objeto JSON válido, sin markdown ni texto antes o después, con esta forma:',
    '{"parrafo": "...", "titulo": "...", "secciones": [{"titulo": "...", "texto": "...", "imagenes": [1]}]}',
    '- "parrafo": un solo párrafo continuo de mínimo 35 palabras que empieza exactamente con "Durante este periodo se" y resume lo realizado.',
    '- "titulo": título del documento de evidencia, con la forma "Informe — <tema>".',
    '- "secciones": entre 2 y 6 secciones que organizan y explican lo realizado, cada una con un título corto y un texto de uno o dos párrafos.',
    '- "imagenes": números de las imágenes de la lista que ilustran esa sección según su descripción; cada imagen en una sola sección; lista vacía si ninguna aplica.',
].join('\n');

// La IA no siempre respeta el formato: se quitan bloques de código y saltos de línea.
function limpiarTexto(t) {
    return t.replace(/```[a-zA-Z]*/g, '').replace(/\s*[\r\n]+\s*/g, ' ').replace(/\s{2,}/g, ' ').trim();
}

function httpError(message, status) {
    const err = new Error(message);
    err.status = status;
    return err;
}

const noEncontrado = () => httpError('No encontrado', 404);

function idValido(v) {
    const n = Number(v);
    if (!Number.isInteger(n) || n <= 0) throw noEncontrado();
    return n;
}

function validarPeriodo(mes, anio) {
    const m = Number(mes);
    const a = Number(anio);
    if (!Number.isInteger(m) || m < 1 || m > 12) throw httpError('Mes inválido', 400);
    if (!Number.isInteger(a) || a < 2020 || a > 2100) throw httpError('Año inválido', 400);
    return { mes: m, anio: a };
}

function texto(v, campo, { requerido = true, max = 5000 } = {}) {
    const s = typeof v === 'string' ? v.trim() : '';
    if (requerido && !s) throw httpError(`${campo} es obligatorio`, 400);
    if (s.length > max) throw httpError(`${campo} es demasiado largo (máximo ${max} caracteres)`, 400);
    return s || null;
}

function armarPrompt({ actividad, registro, imagenes, otras }) {
    const listaImagenes = imagenes.length
        ? imagenes.map((e, i) => `${i + 1}. ${e.descripcion || 'Sin descripción'}`).join('\n')
        : 'Ninguna';
    const listaOtras = otras.length
        ? otras.map((e) => `- ${e.descripcion ? `${e.descripcion}: ` : ''}${e.contenido}`).join('\n')
        : 'Ninguno';
    return `Subactividad del mes de ${MESES[registro.mes - 1]} de ${registro.anio}.

Actividad contractual: ${actividad.nombre}
Descripción contractual: ${actividad.descripcion}

Título de la subactividad: ${tituloDe(registro)}

Notas del contratista:
${registro.desarrollo}

Imágenes adjuntas:
${listaImagenes}

Enlaces y soportes adjuntos:
${listaOtras}`;
}

// Extrae el primer objeto JSON de la respuesta y lo valida. Las imágenes se
// guardan por id de evidencia; índices inválidos o repetidos se ignoran.
function parsearGeneracion(textoIA, imagenIds) {
    const ini = textoIA.indexOf('{');
    const fin = textoIA.lastIndexOf('}');
    let j = null;
    try {
        j = ini >= 0 ? JSON.parse(textoIA.slice(ini, fin + 1)) : null;
    } catch {
        j = null;
    }
    const secciones = Array.isArray(j?.secciones)
        ? j.secciones.filter((s) => s && typeof s.texto === 'string' && s.texto.trim())
        : [];
    if (!j || typeof j.parrafo !== 'string' || !j.parrafo.trim() || !secciones.length) {
        throw httpError('La IA no devolvió el formato esperado, intenta de nuevo', 502);
    }
    const usadas = new Set();
    const ubicar = (n) => Number.isInteger(n) && n >= 1 && n <= imagenIds.length && !usadas.has(n) && usadas.add(n);
    return {
        parrafo: limpiarTexto(j.parrafo),
        documento: {
            titulo: typeof j.titulo === 'string' && j.titulo.trim() ? j.titulo.trim() : null,
            secciones: secciones.map((s) => ({
                titulo: typeof s.titulo === 'string' ? s.titulo.trim() : '',
                texto: s.texto.trim(),
                imagenes: (Array.isArray(s.imagenes) ? s.imagenes : []).map(Number).filter(ubicar).map((n) => imagenIds[n - 1]),
            })),
        },
    };
}

module.exports = (injectedDB, deps = {}) => {

    let data = injectedDB;
    if (!data) data = require('../../database/postgresql');
    const ia = deps.ia || require('../../services/ia').createIAConfigurada(data);
    const storage = deps.storage || require('../../services/onix/storage');
    const word = deps.word || require('../../services/onix/word');
    // La credencial de Google se lee en cada uso (Configuración > Google, sin reiniciar).
    const googleConfig = require('../../services/onix/googleConfig');
    const servicioGoogle = deps.google
        ? async () => deps.google
        : async () => require('../../services/onix/google')({ env: await googleConfig.leerEnvEfectivo({ db: data }) });
    const { cifrar, descifrar } = deps.secreto || require('../../services/ia/secreto');

    async function tienePermiso(email, code) {
        const r = await data.checkSubmodulesPermissionsData(email, code);
        return r[0] ? Number(r[0]['?column?']) !== 0 : false;
    }

    async function getActor(email) {
        const users = await data.findPlatformUserByEmail(email);
        if (!users[0]) throw httpError('Usuario de Bravo Hub no encontrado', 403);
        const userId = users[0].id;
        const [canArea, canAdmin, perfil] = await Promise.all([
            tienePermiso(email, 'onix_reports_area'),
            tienePermiso(email, 'onix_reports_admin'),
            data.onix.getPerfil(userId),
        ]);
        return { userId, email, canArea, canAdmin, areaId: perfil?.area_id ?? null };
    }

    async function puedeVer(actor, ownerId) {
        if (ownerId === actor.userId || actor.canAdmin) return true;
        if (!actor.canArea || !actor.areaId) return false;
        const perfil = await data.onix.getPerfil(ownerId);
        return perfil?.area_id === actor.areaId;
    }

    async function usuarioObjetivo(actor, userId) {
        if (userId === undefined || userId === null || userId === '') return actor.userId;
        const id = idValido(userId);
        if (!(await puedeVer(actor, id))) throw noEncontrado();
        return id;
    }

    async function actividadVisible(actor, id) {
        const a = await data.onix.getActividad(idValido(id));
        if (!a || !(await puedeVer(actor, a.user_id))) throw noEncontrado();
        return a;
    }

    async function actividadPropia(actor, id) {
        const a = await data.onix.getActividad(idValido(id));
        if (!a || a.user_id !== actor.userId) throw noEncontrado();
        return a;
    }

    async function registroPropio(actor, id) {
        const r = await data.onix.getRegistro(idValido(id));
        if (!r || r.user_id !== actor.userId) throw noEncontrado();
        return r;
    }

    async function conEvidencias(registros) {
        if (!registros.length) return [];
        const evs = await data.onix.listEvidenciasDeRegistros(registros.map((r) => r.id));
        return registros.map((r) => ({ ...r, evidencias: evs.filter((e) => e.registro_id === r.id) }));
    }

    async function numeroDe(actividad) {
        const actividades = await data.onix.listActividades(actividad.user_id);
        return actividades.findIndex((a) => a.id === actividad.id) + 1;
    }

    // ── Perfil ──────────────────────────────────────────────────────────────
    async function getPerfil(actor) {
        return data.onix.getPerfil(actor.userId);
    }

    async function savePerfil(actor, body) {
        const area_id = body.area_id ? idValidoArea(body.area_id) : null;
        if (area_id && !(await data.onix.getArea(area_id))) throw httpError('El área no existe', 400);
        return data.onix.upsertPerfil(actor.userId, {
            nombre: texto(body.nombre, 'El nombre', { max: 200 }),
            identificacion: texto(body.identificacion, 'La identificación', { max: 50 }),
            area_id,
            contrato: texto(body.contrato, 'El contrato', { requerido: false, max: 100 }),
            objeto: texto(body.objeto, 'El objeto contractual', { requerido: false }),
        });
    }

    function idValidoArea(v) {
        const n = Number(v);
        if (!Number.isInteger(n) || n <= 0) throw httpError('El área no existe', 400);
        return n;
    }

    // ── Áreas (admin; el permiso lo valida la ruta) ────────────────────────
    function datosArea(body) {
        const color = body.color ? String(body.color).trim() : '#19445e';
        if (!/^#[0-9a-fA-F]{6}$/.test(color)) throw httpError('Color inválido (usa formato #RRGGBB)', 400);
        return { nombre: texto(body.nombre, 'El nombre del área', { max: 100 }), color };
    }

    async function conDuplicado(fn) {
        try {
            return await fn();
        } catch (e) {
            if (e.code === '23505') throw httpError('Ya existe un área con ese nombre', 409);
            throw e;
        }
    }

    const listAreas = () => data.onix.listAreas();

    async function createArea(body) {
        const d = datosArea(body);
        return conDuplicado(() => data.onix.insertArea(d));
    }

    async function updateArea(id, body) {
        const area = await data.onix.getArea(idValido(id));
        if (!area) throw noEncontrado();
        const d = datosArea(body);
        return conDuplicado(() => data.onix.updateArea(area.id, d));
    }

    async function deleteArea(id) {
        const area = await data.onix.deleteArea(idValido(id));
        if (!area) throw noEncontrado();
        return area;
    }

    // ── Actividades ─────────────────────────────────────────────────────────
    function datosActividad(body) {
        const orden = Number(body.orden);
        return {
            nombre: texto(body.nombre, 'El nombre de la actividad', { max: 200 }),
            descripcion: texto(body.descripcion, 'La descripción de la actividad'),
            orden: Number.isInteger(orden) ? orden : 0,
        };
    }

    async function listActividades(actor, userId) {
        return data.onix.listActividades(await usuarioObjetivo(actor, userId));
    }

    async function createActividad(actor, body) {
        return data.onix.insertActividad(actor.userId, datosActividad(body));
    }

    async function updateActividad(actor, id, body) {
        const a = await actividadPropia(actor, id);
        return data.onix.updateActividad(a.id, datosActividad(body));
    }

    async function deleteActividad(actor, id) {
        const a = await actividadPropia(actor, id);
        const imagenes = await data.onix.listImagenesDeActividad(a.id);
        await data.onix.deleteActividad(a.id);
        await Promise.all(imagenes.map((i) => storage.borrar(i.contenido)));
        return a;
    }

    // ── Registros ───────────────────────────────────────────────────────────
    // Con actividad_id: los registros de esa actividad. Sin él: todas las
    // subactividades del mes de un usuario (yo, u otro si puedo verlo).
    async function listRegistros(actor, query) {
        const p = validarPeriodo(query.mes, query.anio);
        if (query.actividad_id === undefined || query.actividad_id === '') {
            const uid = await usuarioObjetivo(actor, query.user_id);
            return conEvidencias(await data.onix.listRegistrosMes(uid, p.mes, p.anio));
        }
        const act = await actividadVisible(actor, query.actividad_id);
        return conEvidencias(await data.onix.listRegistros(act.id, p.mes, p.anio));
    }

    async function createRegistro(actor, body) {
        const act = await actividadPropia(actor, body.actividad_id);
        const p = validarPeriodo(body.mes, body.anio);
        const r = await data.onix.insertRegistro({
            actividad_id: act.id, user_id: actor.userId, ...p,
            titulo: texto(body.titulo, 'El título', { max: 200 }),
            desarrollo: texto(body.desarrollo, 'El desarrollo'),
        });
        return { ...r, actividad_nombre: act.nombre, evidencias: [] };
    }

    // titulo y parrafo son opcionales: si no vienen, se conservan.
    async function updateRegistro(actor, id, body) {
        const r = await registroPropio(actor, id);
        return data.onix.updateRegistro(r.id, {
            desarrollo: texto(body.desarrollo, 'El desarrollo'),
            titulo: body.titulo === undefined ? null : texto(body.titulo, 'El título', { max: 200 }),
            parrafo: body.parrafo === undefined ? null : texto(body.parrafo, 'El párrafo'),
        });
    }

    async function deleteRegistro(actor, id) {
        const r = await registroPropio(actor, id);
        const evs = await data.onix.listEvidenciasDeRegistros([r.id]);
        await data.onix.deleteRegistro(r.id);
        await Promise.all(evs.filter((e) => e.tipo === 'imagen').map((e) => storage.borrar(e.contenido)));
        return r;
    }

    // ── Registros desde las acciones del usuario en Bravo Hub (tabla logs) ──
    const dosDigitos = (n) => String(n).padStart(2, '0');
    const fechaCorta = (d) => {
        const f = new Date(d);
        return `${dosDigitos(f.getDate())}/${dosDigitos(f.getMonth() + 1)}/${f.getFullYear()}`;
    };

    async function listLogsDisponibles(actor, query) {
        const p = validarPeriodo(query.mes, query.anio);
        return data.onix.listLogsDisponibles(actor.email, p.mes, p.anio);
    }

    // Junta las acciones elegidas en un solo registro (una línea por acción).
    // Cada acción solo puede usarse una vez (índice único en onix_registro_logs).
    async function registroDesdeLogs(actor, body) {
        const act = await actividadPropia(actor, body.actividad_id);
        const p = validarPeriodo(body.mes, body.anio);
        const ids = [...new Set((Array.isArray(body.log_ids) ? body.log_ids : []).map(Number))];
        if (!ids.length || ids.some((id) => !Number.isInteger(id) || id <= 0)) {
            throw httpError('Selecciona al menos una acción', 400);
        }
        if (ids.length > 200) throw httpError('Selecciona como máximo 200 acciones a la vez', 400);

        const logs = await data.onix.getLogsPorIds(ids);
        const email = actor.email.toLowerCase();
        if (logs.length !== ids.length || logs.some((l) => (l.username || '').toLowerCase() !== email)) throw noEncontrado();
        if (logs.some((l) => l.usado)) throw httpError('Alguna de las acciones ya fue asignada a una actividad', 409);

        // Una línea por acción; las repetidas el mismo día van juntas con la cantidad.
        const lineas = new Map();
        [...logs].sort((a, b) => new Date(a.date) - new Date(b.date)).forEach((l) => {
            const linea = `- ${fechaCorta(l.date)}: ${l.description}`;
            lineas.set(linea, (lineas.get(linea) || 0) + 1);
        });
        const desarrollo = [...lineas].map(([linea, n]) => (n > 1 ? `${linea} (${n} veces)` : linea)).join('\n');

        const r = await guardarImportado({
            actor, act, p, body, desarrollo, tituloDefecto: 'Acciones en Bravo Hub',
            enlazar: (registroId) => data.onix.insertRegistroLogs(registroId, ids),
            usado: 'Alguna de las acciones ya fue asignada a una actividad',
        });
        return { ...r, logs: ids.length };
    }

    // Lo traído (acciones o eventos) va a una subactividad existente de la misma
    // actividad y mes (registro_id) o a una nueva. `enlazar` marca lo usado; si
    // choca con el índice único (otra pestaña lo usó) responde 409.
    async function guardarImportado({ actor, act, p, body, desarrollo, tituloDefecto, enlazar, usado }) {
        const conflicto = (e) => (e.code === '23505' ? httpError(usado, 409) : e);
        if (body.registro_id != null) {
            const existente = await data.onix.getRegistro(idValido(body.registro_id));
            if (!existente || existente.user_id !== actor.userId || existente.actividad_id !== act.id
                || existente.mes !== p.mes || existente.anio !== p.anio) throw noEncontrado();
            try {
                await enlazar(existente.id);
            } catch (e) {
                throw conflicto(e);
            }
            const r = await data.onix.updateRegistro(existente.id, { desarrollo: `${existente.desarrollo}\n${desarrollo}` });
            return { ...r, actividad_nombre: act.nombre };
        }

        const titulo = texto(body.titulo, 'El título', { requerido: false, max: 200 }) || tituloDefecto;
        const r = await data.onix.insertRegistro({ actividad_id: act.id, user_id: actor.userId, ...p, titulo, desarrollo });
        try {
            await enlazar(r.id);
        } catch (e) {
            await data.onix.deleteRegistro(r.id);
            throw conflicto(e);
        }
        return { ...r, actividad_nombre: act.nombre, evidencias: [] };
    }

    // ── Google Calendar (solo lectura, por usuario) ─────────────────────────
    async function googleEstado(actor) {
        const g = await data.onix.getGoogle(actor.userId);
        return { configurado: (await servicioGoogle()).configurado(), conectado: !!g, email: g?.email || null };
    }

    async function googleUrl(actor) {
        return { url: (await servicioGoogle()).urlAutorizacion(actor.userId) };
    }

    // A dónde vuelve el navegador tras conectar con Google.
    async function googleFront() {
        const { FRONT_URL } = deps.google ? {} : await googleConfig.leerEnvEfectivo({ db: data });
        return `${(FRONT_URL || 'http://localhost:5173').replace(/\/$/, '')}/informes`;
    }

    // Callback de Google (sin token de Bravo Hub): el state firmado trae el usuario.
    async function googleCallback(query) {
        if (query.error) throw httpError(query.error === 'access_denied' ? 'No se dio permiso a Bravo Hub' : `Google respondió: ${query.error}`, 400);
        const google = await servicioGoogle();
        const userId = google.leerEstado(query.state);
        if (!userId) throw httpError('El enlace de conexión venció o no es válido. Vuelve a intentarlo', 400);
        const { refreshToken, email } = await google.canjearCodigo(String(query.code || ''));
        await data.onix.upsertGoogle(userId, email, cifrar(refreshToken));
        return { userId, email };
    }

    async function googleDesconectar(actor) {
        const g = await data.onix.deleteGoogle(actor.userId);
        if (!g) throw noEncontrado();
        await (await servicioGoogle()).revocar(descifrar(g.refresh_token));
        return { conectado: false, email: g.email };
    }

    // Rango del mes en hora de Colombia (UTC-5, sin horario de verano).
    const rangoMes = ({ mes, anio }) => {
        const dos = (n) => String(n).padStart(2, '0');
        const sig = mes === 12 ? { mes: 1, anio: anio + 1 } : { mes: mes + 1, anio };
        return [`${anio}-${dos(mes)}-01T00:00:00-05:00`, `${sig.anio}-${dos(sig.mes)}-01T00:00:00-05:00`];
    };

    async function eventosDelMes(actor, p) {
        const g = await data.onix.getGoogle(actor.userId);
        if (!g) throw httpError('Conecta primero tu cuenta de Google en Configuración', 409);
        const [desde, hasta] = rangoMes(p);
        return (await servicioGoogle()).eventos(descifrar(g.refresh_token), desde, hasta);
    }

    async function listEventosGoogle(actor, query) {
        const p = validarPeriodo(query.mes, query.anio);
        const usados = new Set(await data.onix.listEventosUsados(actor.userId));
        return (await eventosDelMes(actor, p)).filter((e) => !usados.has(e.id));
    }

    const duracion = (min) => {
        if (!min) return '';
        const h = Math.floor(min / 60);
        const m = min % 60;
        return [h && `${h} h`, m && `${m} min`].filter(Boolean).join(' ');
    };

    async function registroDesdeGoogle(actor, body) {
        const act = await actividadPropia(actor, body.actividad_id);
        const p = validarPeriodo(body.mes, body.anio);
        const ids = [...new Set((Array.isArray(body.evento_ids) ? body.evento_ids : []).map(String))].filter((id) => id && id.length <= 1024);
        if (!ids.length) throw httpError('Selecciona al menos un evento', 400);
        if (ids.length > 200) throw httpError('Selecciona como máximo 200 eventos a la vez', 400);

        // Se vuelven a leer de Google: solo se aceptan eventos reales del mes.
        const porId = new Map((await eventosDelMes(actor, p)).map((e) => [e.id, e]));
        const eventos = ids.map((id) => porId.get(id));
        if (eventos.some((e) => !e)) throw noEncontrado();
        const usados = new Set(await data.onix.listEventosUsados(actor.userId));
        if (ids.some((id) => usados.has(id))) throw httpError('Algún evento ya fue asignado a una actividad', 409);

        const desarrollo = eventos
            .sort((a, b) => new Date(a.inicio) - new Date(b.inicio))
            .map((e) => {
                const extra = [duracion(e.duracionMin), e.asistentes > 1 && `${e.asistentes} asistentes`].filter(Boolean).join(', ');
                return `- ${fechaCorta(e.todoElDia ? `${e.inicio}T12:00:00` : e.inicio)}: ${e.titulo}${extra ? ` (${extra})` : ''}`;
            })
            .join('\n');
        const r = await guardarImportado({
            actor, act, p, body, desarrollo, tituloDefecto: eventos.length === 1 ? eventos[0].titulo.slice(0, 200) : 'Reuniones y eventos del mes',
            enlazar: (registroId) => data.onix.insertRegistroEventos(registroId, actor.userId, ids),
            usado: 'Algún evento ya fue asignado a una actividad',
        });
        return { ...r, eventos: ids.length };
    }

    // ── Evidencias ──────────────────────────────────────────────────────────
    async function addEvidencia(actor, body, file) {
        const r = await registroPropio(actor, body.registro_id);
        const descripcion = texto(body.descripcion, 'La descripción', { requerido: false, max: 500 });
        const tipo = body.tipo;

        if (tipo === 'texto' || tipo === 'link') {
            const contenido = texto(body.contenido, tipo === 'link' ? 'El enlace' : 'El texto', { max: 2000 });
            if (tipo === 'link' && !/^https?:\/\//i.test(contenido)) {
                throw httpError('El enlace debe empezar por http:// o https://', 400);
            }
            return data.onix.insertEvidencia({ registro_id: r.id, tipo, contenido, descripcion });
        }
        if (tipo === 'imagen') {
            if (!file) throw httpError('Adjunta una imagen', 400);
            const contenido = await storage.guardarImagen(actor.userId, file);
            try {
                return await data.onix.insertEvidencia({ registro_id: r.id, tipo, contenido, descripcion });
            } catch (e) {
                await storage.borrar(contenido);
                throw e;
            }
        }
        throw httpError('Tipo de evidencia inválido', 400);
    }

    async function updateEvidencia(actor, id, body) {
        const e = await data.onix.getEvidencia(idValido(id));
        if (!e || e.user_id !== actor.userId) throw noEncontrado();
        return data.onix.updateEvidenciaDescripcion(e.id, texto(body.descripcion, 'La descripción', { requerido: false, max: 500 }));
    }

    async function deleteEvidencia(actor, id) {
        const e = await data.onix.getEvidencia(idValido(id));
        if (!e || e.user_id !== actor.userId) throw noEncontrado();
        await data.onix.deleteEvidencia(e.id);
        if (e.tipo === 'imagen') await storage.borrar(e.contenido);
        return e;
    }

    async function getEvidenciaArchivo(actor, id) {
        const e = await data.onix.getEvidencia(idValido(id));
        if (!e || e.tipo !== 'imagen' || !(await puedeVer(actor, e.user_id))) throw noEncontrado();
        return storage.leer(e.contenido);
    }

    // ── Generación con IA (una subactividad) ────────────────────────────────
    async function generarSubactividad(actor, id) {
        const r = await registroPropio(actor, id);
        if (!(await data.onix.getPerfil(actor.userId))) {
            throw httpError('Completa tu perfil (nombre e identificación) antes de generar informes', 400);
        }
        const act = await data.onix.getActividad(r.actividad_id);
        const [conEv] = await conEvidencias([r]);
        const imagenes = conEv.evidencias.filter((e) => e.tipo === 'imagen');
        const otras = conEv.evidencias.filter((e) => e.tipo !== 'imagen');
        const system = `${await leerPromptInformes(data)}\n${FORMATO_SALIDA}`;
        const res = await ia.generarTexto({ system, prompt: armarPrompt({ actividad: act, registro: r, imagenes, otras }) });
        const g = parsearGeneracion(res.texto, imagenes.map((e) => e.id));
        const guardado = await data.onix.guardarGeneracion(r.id, { ...g, proveedor: res.proveedor, modelo: res.modelo });
        return { ...guardado, actividad_nombre: act.nombre, evidencias: conEv.evidencias };
    }

    // ── Documentos (Word y zip con la estructura de Drive) ──────────────────
    async function registroVisible(actor, id) {
        const r = await data.onix.getRegistro(idValido(id));
        if (!r || !(await puedeVer(actor, r.user_id))) throw noEncontrado();
        return r;
    }

    // id de evidencia -> { datos, ext } | null (imagen ilegible)
    async function leerImagenes(evidencias) {
        const fotos = evidencias.filter((e) => e.tipo === 'imagen');
        return new Map(await Promise.all(fotos.map(async (e) => {
            const a = await storage.leer(e.contenido).catch(() => null);
            return [e.id, a ? { datos: a.datos, ext: a.mime === 'image/png' ? 'png' : 'jpg' } : null];
        })));
    }

    async function armarSubactividad(r) {
        const [conEv] = await conEvidencias([r]);
        return word.documentoSubactividad({ registro: r, evidencias: conEv.evidencias, imagenes: await leerImagenes(conEv.evidencias) });
    }

    const errorPendientes = (lista) => httpError(`Genera primero con IA: ${lista.slice(0, 3).map((r) => `"${tituloDe(r)}"`).join(', ')}${lista.length > 3 ? ` y ${lista.length - 3} más` : ''}`, 400);

    async function subactividadWord(actor, id) {
        const r = await registroVisible(actor, id);
        if (!r.documento) throw errorPendientes([r]);
        return { buffer: await armarSubactividad(r), filename: `${nombreArchivo(tituloDe(r))}.docx` };
    }

    async function documentoActividadWord(actor, actividadId, query) {
        const act = await actividadVisible(actor, actividadId);
        const p = validarPeriodo(query.mes, query.anio);
        const registros = await data.onix.listRegistros(act.id, p.mes, p.anio);
        if (!registros.length) throw httpError(`No hay subactividades de "${act.nombre}" en ${MESES[p.mes - 1]} de ${p.anio}`, 400);
        const sinParrafo = registros.filter((r) => !r.parrafo);
        if (sinParrafo.length) throw errorPendientes(sinParrafo);
        const [numero, perfil] = await Promise.all([numeroDe(act), data.onix.getPerfil(act.user_id)]);
        const buffer = await word.documentoActividad({ actividad: act, numero, registros, ...p, perfil });
        return { buffer, filename: `Evidencia_${MESES[p.mes - 1]}_actividad_${numero}.docx` };
    }

    // <n>_<MES>/Actividad <k>/Evidencia_<Mes>_actividad_<k>.docx + un Word por
    // subactividad. Solo actividades con subactividades; todas deben estar generadas.
    async function zipMes(actor, query) {
        const uid = await usuarioObjetivo(actor, query.user_id);
        const p = validarPeriodo(query.mes, query.anio);
        const [actividades, registros, perfil] = await Promise.all([
            data.onix.listActividades(uid),
            data.onix.listRegistrosMes(uid, p.mes, p.anio),
            data.onix.getPerfil(uid),
        ]);
        if (!registros.length) throw httpError(`No hay subactividades en ${MESES[p.mes - 1]} de ${p.anio}`, 400);
        const faltan = registros.filter((r) => !r.parrafo || !r.documento);
        if (faltan.length) throw errorPendientes(faltan);

        const zip = new JSZip();
        const mes = zip.folder(`${p.mes}_${MESES[p.mes - 1].toUpperCase()}`);
        for (const [i, act] of actividades.entries()) {
            const suyas = registros.filter((r) => r.actividad_id === act.id);
            if (!suyas.length) continue;
            const carpeta = mes.folder(`Actividad ${i + 1}`);
            carpeta.file(`Evidencia_${MESES[p.mes - 1]}_actividad_${i + 1}.docx`,
                await word.documentoActividad({ actividad: act, numero: i + 1, registros: suyas, ...p, perfil }));
            const usados = new Set();
            for (const r of suyas) {
                const base = nombreArchivo(tituloDe(r));
                let nombre = base;
                for (let k = 2; usados.has(nombre.toLowerCase()); k++) nombre = `${base} (${k})`;
                usados.add(nombre.toLowerCase());
                carpeta.file(`${nombre}.docx`, await armarSubactividad(r));
            }
        }
        const buffer = await zip.generateAsync({ type: 'nodebuffer' });
        return { buffer, filename: `Informe_${MESES[p.mes - 1]}_${p.anio}.zip` };
    }

    async function listUsuariosArea(actor, query) {
        if (!actor.canArea && !actor.canAdmin) throw httpError('No tienes permiso para ver informes de otros usuarios', 403);
        const p = validarPeriodo(query.mes, query.anio);
        if (actor.canAdmin) return data.onix.listUsuariosConPerfil(null, p.mes, p.anio);
        if (!actor.areaId) return [];
        return data.onix.listUsuariosConPerfil(actor.areaId, p.mes, p.anio);
    }

    return {
        getActor,
        getPerfil, savePerfil,
        listAreas, createArea, updateArea, deleteArea,
        listActividades, createActividad, updateActividad, deleteActividad,
        listRegistros, createRegistro, updateRegistro, deleteRegistro,
        listLogsDisponibles, registroDesdeLogs,
        googleEstado, googleUrl, googleFront, googleCallback, googleDesconectar, listEventosGoogle, registroDesdeGoogle,
        addEvidencia, updateEvidencia, deleteEvidencia, getEvidenciaArchivo,
        generarSubactividad, subactividadWord, documentoActividadWord, zipMes,
        listUsuariosArea,
    };
};
