const database = require('../database/postgresql');

// Registra un error de sincronización en la tabla `logs` (id, date, type, description, username).
// No lanza si falla el registro en sí: un problema al loguear no debe tumbar el proceso de sync.
async function logSyncError(entityType, entityId, message, username) {
    const description = `[${entityType}:${entityId}] ${message}`;
    try {
        await database.insertLog(`sync_error_${entityType}`, description, username || 'system', entityType, entityId);
    } catch (err) {
        console.error('No se pudo registrar el error de sync en logs:', err.message);
    }
}

module.exports = { logSyncError };
