module.exports = (injectedDB) => {
    let data = injectedDB;
    if (!data) data = require('../../database/postgresql');

    async function getMyPlatformUserId(email) {
        const result = await data.findPlatformUserByEmail(email);
        return result[0]?.id || null;
    }

    async function listMine(email, limit) {
        const platformUserId = await getMyPlatformUserId(email);
        if (!platformUserId) return [];
        return data.listNotificationsForUser(platformUserId, limit || 30);
    }

    async function countUnread(email) {
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
