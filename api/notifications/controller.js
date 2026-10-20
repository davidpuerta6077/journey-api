// No hay scheduler/cron dentro de la API: se aprovecha que la campanita del
// front hace polling de unread-count cada 30s mientras haya alguien logueado
// para generar las notificaciones de cumpleaños "al vuelo", máximo una vez
// por día (guardado en memoria del proceso). Best-effort: si falla, no debe
// tumbar el conteo/listado de notificaciones de quien esté consultando.
let ultimaRevisionCumpleanos = null;

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

    async function getMyPlatformUserId(email) {
        const result = await data.findPlatformUserByEmail(email);
        return result[0]?.id || null;
    }

    async function listMine(email, limit) {
        await asegurarNotificacionesCumpleanos();
        const platformUserId = await getMyPlatformUserId(email);
        if (!platformUserId) return [];
        return data.listNotificationsForUser(platformUserId, limit || 30);
    }

    async function countUnread(email) {
        await asegurarNotificacionesCumpleanos();
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
