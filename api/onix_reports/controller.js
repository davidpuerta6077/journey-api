// Módulo Informes (Onix-IA). Reglas de acceso:
//  - dueño (onix_reports_use): lee y escribe lo suyo;
//  - onix_reports_area: lee lo de usuarios de su misma área (según su perfil);
//  - onix_reports_admin: lee todo y administra áreas.
// Nadie escribe datos de otro usuario. Lo ajeno o inexistente responde 404.

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

const SYSTEM_PROMPT = 'Eres un asistente que redacta informes institucionales formales en español colombiano para la Institución Universitaria Pascual Bravo. Responde únicamente en español. Devuelve solo el párrafo pedido, sin títulos, viñetas, comillas ni comentarios adicionales.';

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

function armarPrompt({ actividad, registros, mes, anio }) {
    const lista = registros.map((r) => `- ${r.desarrollo}`).join('\n');
    return `Basándote en los siguientes registros de trabajo del mes de ${MESES[mes - 1]} de ${anio}, redacta el desarrollo de la actividad de forma profesional y formal, en un solo párrafo cohesionado, como en un informe oficial universitario. No uses viñetas ni listas.

Actividad: ${actividad.nombre}
Descripción contractual: ${actividad.descripcion}

Registros del mes:
${lista}`;
}

module.exports = (injectedDB, deps = {}) => {

    let data = injectedDB;
    if (!data) data = require('../../database/postgresql');
    const ia = deps.ia || require('../../services/ia').createIAConfigurada(data);
    const storage = deps.storage || require('../../services/onix/storage');
    const word = deps.word || require('../../services/onix/word');

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
    async function listRegistros(actor, query) {
        const act = await actividadVisible(actor, query.actividad_id);
        const p = validarPeriodo(query.mes, query.anio);
        return conEvidencias(await data.onix.listRegistros(act.id, p.mes, p.anio));
    }

    async function createRegistro(actor, body) {
        const act = await actividadPropia(actor, body.actividad_id);
        const p = validarPeriodo(body.mes, body.anio);
        const r = await data.onix.insertRegistro({
            actividad_id: act.id, user_id: actor.userId, ...p,
            desarrollo: texto(body.desarrollo, 'El desarrollo'),
        });
        return { ...r, actividad_nombre: act.nombre, evidencias: [] };
    }

    async function updateRegistro(actor, id, body) {
        const r = await registroPropio(actor, id);
        return data.onix.updateRegistro(r.id, texto(body.desarrollo, 'El desarrollo'));
    }

    async function deleteRegistro(actor, id) {
        const r = await registroPropio(actor, id);
        const evs = await data.onix.listEvidenciasDeRegistros([r.id]);
        await data.onix.deleteRegistro(r.id);
        await Promise.all(evs.filter((e) => e.tipo === 'imagen').map((e) => storage.borrar(e.contenido)));
        return r;
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
        return { ruta: storage.rutaAbsoluta(e.contenido) };
    }

    // ── Informes ────────────────────────────────────────────────────────────
    async function listInformes(actor, query) {
        const uid = await usuarioObjetivo(actor, query.user_id);
        const p = validarPeriodo(query.mes, query.anio);
        return data.onix.listInformes(uid, p.mes, p.anio);
    }

    async function generarInforme(actor, body) {
        const act = await actividadPropia(actor, body.actividad_id);
        const p = validarPeriodo(body.mes, body.anio);
        if (!(await data.onix.getPerfil(actor.userId))) {
            throw httpError('Completa tu perfil (nombre e identificación) antes de generar informes', 400);
        }
        const registros = await data.onix.listRegistros(act.id, p.mes, p.anio);
        if (!registros.length) {
            throw httpError(`No hay registros de "${act.nombre}" en ${MESES[p.mes - 1]} de ${p.anio}`, 400);
        }
        const r = await ia.generarTexto({ system: SYSTEM_PROMPT, prompt: armarPrompt({ actividad: act, registros, ...p }) });
        const informe = await data.onix.upsertInforme({
            user_id: actor.userId, actividad_id: act.id, ...p,
            desarrollo: r.texto, proveedor: r.proveedor, modelo: r.modelo,
        });
        return { ...informe, actividad_nombre: act.nombre };
    }

    async function updateInforme(actor, id, body) {
        const inf = await data.onix.getInforme(idValido(id));
        if (!inf || inf.user_id !== actor.userId) throw noEncontrado();
        const act = await data.onix.getActividad(inf.actividad_id);
        const actualizado = await data.onix.updateInformeTexto(inf.id, texto(body.desarrollo, 'El desarrollo', { max: 20000 }));
        return { ...actualizado, actividad_nombre: act?.nombre };
    }

    async function informeWord(actor, id) {
        const inf = await data.onix.getInforme(idValido(id));
        if (!inf || !(await puedeVer(actor, inf.user_id))) throw noEncontrado();
        const act = await data.onix.getActividad(inf.actividad_id);
        const [numero, perfil, registros] = await Promise.all([
            numeroDe(act),
            data.onix.getPerfil(inf.user_id),
            data.onix.listRegistros(act.id, inf.mes, inf.anio),
        ]);
        const evidencias = (await conEvidencias(registros)).flatMap((r) => r.evidencias);
        const buffer = await word.informeActividad({ actividad: act, numero, desarrollo: inf.desarrollo, evidencias, mes: inf.mes, anio: inf.anio, perfil });
        return { buffer, filename: `Informe_Actividad_${numero}_${word.nombreMes(inf.mes)}_${inf.anio}.docx` };
    }

    async function evidenciasWord(actor, actividadId, query) {
        const act = await actividadVisible(actor, actividadId);
        const p = validarPeriodo(query.mes, query.anio);
        const registros = await conEvidencias(await data.onix.listRegistros(act.id, p.mes, p.anio));
        const evidencias = registros.flatMap((r) => r.evidencias);
        if (!evidencias.length) {
            throw httpError(`No hay evidencias de "${act.nombre}" en ${MESES[p.mes - 1]} de ${p.anio}`, 400);
        }
        const conImagen = await Promise.all(evidencias.map(async (e) => (e.tipo === 'imagen'
            ? { ...e, imagen: await storage.leer(e.contenido).catch(() => null), ext: storage.extension(e.contenido) }
            : e)));
        const numero = await numeroDe(act);
        const buffer = await word.evidenciasActividad({ actividad: act, numero, registros, evidencias: conImagen, ...p });
        return { buffer, filename: `Evidencias_Actividad_${numero}_${word.nombreMes(p.mes)}_${p.anio}.docx` };
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
        addEvidencia, deleteEvidencia, getEvidenciaArchivo,
        listInformes, generarInforme, updateInforme, informeWord, evidenciasWord,
        listUsuariosArea,
    };
};
