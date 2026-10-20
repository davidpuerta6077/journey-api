// Módulo Atom: widget de tareas embebido en el Index (sin ruta ni entrada en
// el sidebar propias, ver api/atom/network.js). Visibilidad por defecto: cada
// quien ve solo lo que creó o lo que tiene asignado; atom_admin puede pedir
// "todas" para estadísticas/auditoría, nunca automático.

const ESTADOS = ['Pendiente', 'En proceso', 'En revisión', 'Completada', 'Cancelada'];
const PRIORIDADES = ['Baja', 'Media', 'Alta', 'Urgente'];
// Campos que se comparan para dejar rastro en atom_task_history en cada edición.
const CAMPOS_HISTORIAL = ['title', 'description', 'priority', 'status', 'category', 'due_date', 'assigned_to'];

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

function tituloValido(v) {
    const s = typeof v === 'string' ? v.trim() : '';
    if (!s) throw httpError('Escribe un título para la tarea', 400);
    if (s.length > 200) throw httpError('El título no puede pasar de 200 caracteres', 400);
    return s;
}

function prioridadValida(v) {
    if (v === undefined || v === null || v === '') return 'Media';
    if (!PRIORIDADES.includes(v)) throw httpError(`Prioridad inválida: ${v}`, 400);
    return v;
}

function estadoValido(v) {
    if (v === undefined || v === null || v === '') return 'Pendiente';
    if (!ESTADOS.includes(v)) throw httpError(`Estado inválido: ${v}`, 400);
    return v;
}

const aFechaTexto = (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : v) ?? null;

module.exports = function createController(data) {
    async function getActor(email) {
        const a = await data.atom.getActor(email);
        if (!a) throw httpError('Usuario de Bravo Hub no encontrado', 403);
        return { userId: a.user_id, roleId: a.role_id, roleName: a.role_name, esAdmin: a.es_admin, puedeAsignar: a.puede_asignar };
    }

    function tieneAcceso(actor, task) {
        return actor.esAdmin || task.created_by === actor.userId || task.assigned_to === actor.userId;
    }

    async function cargarPropia(actor, id) {
        const t = await data.atom.getTask(idValido(id));
        if (!t || !tieneAcceso(actor, t)) throw noEncontrado();
        return t;
    }

    // Best-effort, igual patrón que SICAU (registrarNovedadSicau/notificarNovedadSicau):
    // si falla, nunca debe tumbar la operación principal sobre la tarea.
    async function notificarAtom({ tipo, titulo, cuerpo, taskId, paraUserId }) {
        if (!paraUserId) return;
        try {
            const notification = await data.insertNotification({
                type: tipo, title: titulo, body: cuerpo || null,
                entity_type: 'atom_task', entity_id: taskId, link: `/?atom_task=${taskId}`,
            });
            await data.addNotificationRecipient(notification.id, paraUserId);
        } catch (err) {
            console.error('No se pudo notificar en Atom:', err.message);
        }
    }

    async function listTasks(actor, filtros = {}) {
        const todas = !!(actor.esAdmin && filtros.todas);
        const [tasks, counts] = await Promise.all([
            data.atom.listTasks(actor.userId, todas, filtros),
            data.atom.counts(actor.userId),
        ]);
        return { tasks, counts };
    }

    async function getTaskDetalle(actor, id) {
        const t = await cargarPropia(actor, id);
        const [subtasks, comments, history] = await Promise.all([
            data.atom.getSubtasks(t.id),
            data.atom.getComments(t.id),
            data.atom.getHistory(t.id),
        ]);
        return { ...t, subtasks, comments, history };
    }

    async function createTask(actor, body = {}) {
        const title = tituloValido(body.title);
        const priority = prioridadValida(body.priority);
        const status = estadoValido(body.status);
        const assignedTo = body.assigned_to ? idValido(body.assigned_to) : null;
        if (assignedTo && assignedTo !== actor.userId && !actor.puedeAsignar) {
            throw httpError('No tienes permiso para asignar tareas a otros usuarios', 403);
        }
        const task = await data.atom.insertTask({
            title, description: body.description || null, priority, status,
            category: body.category || null, due_date: body.due_date || null,
            created_by: actor.userId, assigned_to: assignedTo,
        });
        const subtaskTitles = Array.isArray(body.subtasks) ? body.subtasks.filter((s) => typeof s === 'string' && s.trim()) : [];
        for (let i = 0; i < subtaskTitles.length; i++) {
            await data.atom.insertSubtask(task.id, subtaskTitles[i].trim(), i);
        }
        if (assignedTo && assignedTo !== actor.userId) {
            await notificarAtom({ tipo: 'atom_asignacion', titulo: `📋 Te asignaron una tarea: "${title}"`, taskId: task.id, paraUserId: assignedTo });
        }
        return task;
    }

    async function updateTask(actor, id, body = {}) {
        const t = await cargarPropia(actor, id);
        const assignedTo = body.assigned_to !== undefined ? (body.assigned_to ? idValido(body.assigned_to) : null) : t.assigned_to;
        if (assignedTo !== t.assigned_to && assignedTo && assignedTo !== actor.userId && !actor.puedeAsignar) {
            throw httpError('No tienes permiso para asignar tareas a otros usuarios', 403);
        }
        const next = {
            title: body.title !== undefined ? tituloValido(body.title) : t.title,
            description: body.description !== undefined ? (body.description || null) : t.description,
            priority: body.priority !== undefined ? prioridadValida(body.priority) : t.priority,
            status: body.status !== undefined ? estadoValido(body.status) : t.status,
            category: body.category !== undefined ? (body.category || null) : t.category,
            due_date: body.due_date !== undefined ? (body.due_date || null) : aFechaTexto(t.due_date),
            assigned_to: assignedTo,
        };

        const asignadoAnterior = t.assigned_to;
        const updated = await data.atom.updateTask(t.id, next);

        const cambios = [];
        for (const campo of CAMPOS_HISTORIAL) {
            const antes = campo === 'due_date' ? aFechaTexto(t[campo]) : (t[campo] ?? null);
            const actual = next[campo] ?? null;
            if (String(antes ?? '') !== String(actual ?? '')) {
                cambios.push(campo);
                await data.atom.insertHistory(t.id, actor.userId, campo, antes != null ? String(antes) : null, actual != null ? String(actual) : null);
            }
        }

        if (cambios.includes('assigned_to')) {
            if (updated.assigned_to && updated.assigned_to !== actor.userId) {
                await notificarAtom({ tipo: 'atom_asignacion', titulo: `📋 Te asignaron una tarea: "${updated.title}"`, taskId: t.id, paraUserId: updated.assigned_to });
            }
            // A quien tenía la tarea antes y ya no la tiene (se la quitaron o se la
            // pasaron a otra persona) también le interesa saber que ya no es suya.
            if (asignadoAnterior && asignadoAnterior !== updated.assigned_to && asignadoAnterior !== actor.userId) {
                await notificarAtom({ tipo: 'atom_desasignacion', titulo: `🚫 Ya no estás a cargo de "${updated.title}"`, taskId: t.id, paraUserId: asignadoAnterior });
            }
        }
        if (cambios.includes('due_date')) {
            const contraparte = actor.userId === updated.created_by ? updated.assigned_to : updated.created_by;
            if (contraparte && contraparte !== actor.userId) {
                await notificarAtom({ tipo: 'atom_fecha', titulo: `🗓️ Cambió la fecha de "${updated.title}"`, cuerpo: updated.due_date ? `Nueva fecha límite: ${aFechaTexto(updated.due_date)}` : 'Se quitó la fecha límite', taskId: t.id, paraUserId: contraparte });
            }
        }
        if (cambios.includes('priority') && ['Alta', 'Urgente'].includes(updated.priority)) {
            const contraparte = actor.userId === updated.created_by ? updated.assigned_to : updated.created_by;
            if (contraparte && contraparte !== actor.userId) {
                await notificarAtom({ tipo: 'atom_prioridad', titulo: `⬆️ "${updated.title}" subió a prioridad ${updated.priority}`, taskId: t.id, paraUserId: contraparte });
            }
        }
        if (cambios.includes('status')) await notificarCambioEstado(actor, updated);

        return updated;
    }

    // Completada: avisa al creador (si fue alguien más quien la completó).
    // Cancelada: avisa al asignado (si fue alguien más quien la canceló).
    // Compartido entre updateTask y bulkEstado para no duplicar la regla.
    async function notificarCambioEstado(actor, task) {
        if (task.status === 'Completada' && task.created_by !== actor.userId) {
            await notificarAtom({ tipo: 'atom_completada', titulo: `✅ Completaron la tarea "${task.title}"`, taskId: task.id, paraUserId: task.created_by });
        }
        if (task.status === 'Cancelada' && task.assigned_to && task.assigned_to !== actor.userId) {
            await notificarAtom({ tipo: 'atom_cancelada', titulo: `❌ Se canceló la tarea "${task.title}"`, taskId: task.id, paraUserId: task.assigned_to });
        }
    }

    async function addComment(actor, id, body = {}) {
        const t = await cargarPropia(actor, id);
        const texto = typeof body.body === 'string' ? body.body.trim() : '';
        if (!texto) throw httpError('Escribe un comentario', 400);
        const comment = await data.atom.insertComment(t.id, actor.userId, texto);
        const contraparte = actor.userId === t.created_by ? t.assigned_to : t.created_by;
        if (contraparte && contraparte !== actor.userId) {
            await notificarAtom({ tipo: 'atom_comentario', titulo: `💬 Nuevo comentario en "${t.title}"`, cuerpo: texto.slice(0, 140), taskId: t.id, paraUserId: contraparte });
        }
        // Menciones "@username" en el texto (usernames de Bravo Hub pueden traer
        // espacios, así que se busca por substring "@" + username completo, no por
        // palabra suelta). Nota: si a quien mencionan no es dueño/asignado/admin de
        // la tarea, el link de la notificación no le va a abrir el detalle (404) —
        // sirve hoy como aviso informal; cuando haya "interesados" de una tarea se
        // puede dar acceso real.
        try {
            const activos = await data.atom.usuariosActivos();
            const yaNotificados = new Set([actor.userId, contraparte].filter(Boolean));
            for (const u of activos) {
                if (yaNotificados.has(u.id)) continue;
                if (!texto.includes(`@${u.username}`)) continue;
                yaNotificados.add(u.id);
                await notificarAtom({ tipo: 'atom_mencion', titulo: `📣 Te mencionaron en "${t.title}"`, cuerpo: texto.slice(0, 140), taskId: t.id, paraUserId: u.id });
            }
        } catch (err) {
            console.error('No se pudieron procesar las menciones de Atom:', err.message);
        }
        return comment;
    }

    async function toggleSubtask(actor, taskId, subtaskId, done) {
        const t = await cargarPropia(actor, taskId);
        const sub = await data.atom.getSubtask(idValido(subtaskId));
        if (!sub || sub.task_id !== t.id) throw noEncontrado();
        const resultado = await data.atom.setSubtaskDone(sub.id, !!done);

        if (done && !['Completada', 'Cancelada'].includes(t.status)) {
            const todas = await data.atom.getSubtasks(t.id);
            if (todas.length > 0 && todas.every((s) => s.done)) {
                const contraparte = actor.userId === t.created_by ? t.assigned_to : t.created_by;
                if (contraparte && contraparte !== actor.userId) {
                    await notificarAtom({ tipo: 'atom_subtareas_completas', titulo: `☑️ Todas las subtareas de "${t.title}" están listas`, taskId: t.id, paraUserId: contraparte });
                }
            }
        }

        return resultado;
    }

    async function bulkEstado(actor, ids, estado) {
        const status = estadoValido(estado);
        const resultados = [];
        for (const rawId of Array.isArray(ids) ? ids : []) {
            try {
                const t = await cargarPropia(actor, rawId);
                if (t.status === status) { resultados.push({ id: t.id, ok: true }); continue; }
                const updated = await data.atom.updateTask(t.id, {
                    title: t.title, description: t.description, priority: t.priority, status,
                    category: t.category, due_date: aFechaTexto(t.due_date), assigned_to: t.assigned_to,
                });
                await data.atom.insertHistory(t.id, actor.userId, 'status', t.status, status);
                await notificarCambioEstado(actor, updated);
                resultados.push({ id: t.id, ok: true });
            } catch (err) {
                resultados.push({ id: Number(rawId) || rawId, ok: false, error: err.message });
            }
        }
        return resultados;
    }

    async function assignableUsers(q) {
        return data.searchPlatformUsersShare((q || '').trim());
    }

    async function statsGlobal() {
        return data.atom.statsGlobal();
    }

    return {
        getActor, listTasks, getTaskDetalle, createTask, updateTask, addComment,
        toggleSubtask, bulkEstado, assignableUsers, statsGlobal, notificarAtom,
    };
};
