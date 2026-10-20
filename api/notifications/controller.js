// No hay scheduler/cron dentro de la API: se aprovecha que la campanita del
// front hace polling de unread-count cada 30s mientras haya alguien logueado
// para generar las notificaciones de cumpleaños "al vuelo", máximo una vez
// por día (guardado en memoria del proceso). Best-effort: si falla, no debe
// tumbar el conteo/listado de notificaciones de quien esté consultando.
let ultimaRevisionCumpleanos = null;
let ultimaRevisionAtomVencidas = null;
let ultimaRevisionAtomResumen = null;
let ultimaRevisionAtomEstancadas = null;

// Días sin actividad (sin editar campos ni comentar) para considerar una
// tarea "estancada" y avisarle al creador.
const DIAS_ESTANCADA = 5;

module.exports = (injectedDB) => {
    let data = injectedDB;
    if (!data) data = require('../../database/postgresql');

    async function asegurarNotificacionesCumpleanos() {
        const hoy = new Date().toISOString().slice(0, 10);
        if (ultimaRevisionCumpleanos === hoy) return;
        ultimaRevisionCumpleanos = hoy;
        try {
            const cumpleaneros = await data.getPlatformUsersWithBirthdayToday();
            for (const u of cumpleaneros) {
                if (await data.hasBirthdayNotificationToday(u.id)) continue;
                const notification = await data.insertNotification({
                    type: 'birthday',
                    title: `🎉 ¡Feliz cumpleaños, ${u.username}!`,
                    body: 'Que tengas un gran día.',
                    entity_type: 'platform_user',
                    entity_id: u.id,
                });
                await data.addNotificationRecipient(notification.id, u.id);
            }
        } catch (err) {
            console.error('No se pudo generar las notificaciones de cumpleaños:', err.message);
        }
    }

    // Mismo piggyback que cumpleaños: una tarea avisa "vence hoy" o "vencida"
    // como máximo una vez por día, al que la tenga asignada (o a quien la creó
    // si no hay asignado).
    async function asegurarNotificacionesAtomVencidas() {
        const hoy = new Date().toISOString().slice(0, 10);
        if (ultimaRevisionAtomVencidas === hoy) return;
        ultimaRevisionAtomVencidas = hoy;
        try {
            const tareas = await data.atom.tasksVencenHoyOVencidas();
            for (const t of tareas) {
                const tipo = t.vencida ? 'atom_vencida' : 'atom_por_vencer';
                if (await data.atom.existsAtomNotificationToday(t.id, tipo)) continue;
                const paraUserId = t.assigned_to || t.created_by;
                const notification = await data.insertNotification({
                    type: tipo,
                    title: t.vencida ? `⚠️ "${t.title}" está vencida` : `⏰ "${t.title}" vence hoy`,
                    entity_type: 'atom_task',
                    entity_id: t.id,
                    link: `/?atom_task=${t.id}`,
                });
                await data.addNotificationRecipient(notification.id, paraUserId);
            }
        } catch (err) {
            console.error('No se pudo generar las notificaciones de tareas vencidas de Atom:', err.message);
        }
    }

    // Aviso agregado (una vez al día por persona): "Tienes 3 vencidas y 2 que
    // vencen hoy", además de los avisos puntuales por tarea de arriba — útil
    // para quien tiene varias en vez de recibir un aviso por cada una.
    async function asegurarResumenDiarioAtom() {
        const hoy = new Date().toISOString().slice(0, 10);
        if (ultimaRevisionAtomResumen === hoy) return;
        ultimaRevisionAtomResumen = hoy;
        try {
            const porUsuario = await data.atom.resumenVencimientosPorUsuario();
            for (const r of porUsuario) {
                const vencidas = Number(r.vencidas) || 0;
                const porVencer = Number(r.por_vencer) || 0;
                if (vencidas === 0 && porVencer === 0) continue;
                if (await data.atom.existsAtomResumenHoy(r.user_id)) continue;
                const partes = [];
                if (vencidas > 0) partes.push(`${vencidas} vencida${vencidas > 1 ? 's' : ''}`);
                if (porVencer > 0) partes.push(`${porVencer} que vence${porVencer > 1 ? 'n' : ''} hoy`);
                const notification = await data.insertNotification({
                    type: 'atom_resumen_diario',
                    title: `📊 Tienes ${partes.join(' y ')} en Atom`,
                    entity_type: 'platform_user',
                    entity_id: r.user_id,
                    link: '/',
                });
                await data.addNotificationRecipient(notification.id, r.user_id);
            }
        } catch (err) {
            console.error('No se pudo generar el resumen diario de Atom:', err.message);
        }
    }

    // Tareas sin ningún movimiento (ni edición ni comentario) en DIAS_ESTANCADA
    // días: le avisa al creador para que decida si sigue vigente. No se repite
    // todos los días mientras sigue estancada, solo cada vez que se vuelve a
    // cumplir el umbral (dedup por rango, no por fecha calendario).
    async function asegurarNotificacionesAtomEstancadas() {
        const hoy = new Date().toISOString().slice(0, 10);
        if (ultimaRevisionAtomEstancadas === hoy) return;
        ultimaRevisionAtomEstancadas = hoy;
        try {
            const tareas = await data.atom.tasksEstancadas(DIAS_ESTANCADA);
            for (const t of tareas) {
                if (await data.atom.existsAtomNotificationRecent(t.id, 'atom_estancada', DIAS_ESTANCADA)) continue;
                const notification = await data.insertNotification({
                    type: 'atom_estancada',
                    title: `💤 "${t.title}" lleva ${DIAS_ESTANCADA} días sin movimiento`,
                    entity_type: 'atom_task',
                    entity_id: t.id,
                    link: `/?atom_task=${t.id}`,
                });
                await data.addNotificationRecipient(notification.id, t.created_by);
            }
        } catch (err) {
            console.error('No se pudo generar las notificaciones de tareas estancadas de Atom:', err.message);
        }
    }

    async function getMyPlatformUserId(email) {
        const result = await data.findPlatformUserByEmail(email);
        return result[0]?.id || null;
    }

    async function listMine(email, limit) {
        await asegurarNotificacionesCumpleanos();
        await asegurarNotificacionesAtomVencidas();
        await asegurarResumenDiarioAtom();
        await asegurarNotificacionesAtomEstancadas();
        const platformUserId = await getMyPlatformUserId(email);
        if (!platformUserId) return [];
        return data.listNotificationsForUser(platformUserId, limit || 30);
    }

    async function countUnread(email) {
        await asegurarNotificacionesCumpleanos();
        await asegurarNotificacionesAtomVencidas();
        await asegurarResumenDiarioAtom();
        await asegurarNotificacionesAtomEstancadas();
        const platformUserId = await getMyPlatformUserId(email);
        if (!platformUserId) return 0;
        return data.countUnreadNotifications(platformUserId);
    }

    async function markRead(email, notificationId) {
        const platformUserId = await getMyPlatformUserId(email);
        if (!platformUserId) return null;
        return data.markNotificationRead(notificationId, platformUserId);
    }

    async function markAllRead(email) {
        const platformUserId = await getMyPlatformUserId(email);
        if (!platformUserId) return [];
        return data.markAllNotificationsRead(platformUserId);
    }

    return {
        listMine,
        countUnread,
        markRead,
        markAllRead,
    };
};
