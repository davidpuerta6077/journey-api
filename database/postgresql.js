const config = require('../config');
const { Pool } = require('pg');
const {
    selectAllItems,
    selectAllUsers, selectUsersForSync, insertUsuarioData, updateUsuarioData,
    updateUsuarioJourney, deleteUsuarioData,
    updateUserMoodleId, clearUserMoodleId, findUserByEmailOrUsername,
    findUserByDocumento, updateUserSicau,
    updateUserSyncStatusQuery, updateUserUnsyncQuery,selectEnrollmentsByUserId,
    updateUserPassword,
    selectAllCourses, selectCoursesForSync, selectDistinctAsignaturas, insertCourseData, updateCourseData,
    updateCourseMoodleId, findCourseByIdnumber, findCourseByShortname,
    updateCourseSyncStatusQuery, updateCourseSyncingQuery, updateCourseSyncErrorQuery,
    updateCourseFromSicauQuery,
    selectAllEnrollments, selectEnrollmentsForSync, insertEnrollmentData,
    updateEnrollmentData, updateEnrollmentMoodleId, findEnrollmentByCodigoJourney,
    findEnrollmentByUserAndCourse,
    updateEnrollmentEstadoQuery, updateEnrollmentSyncFields,
    findAllEnrollmentsWithUsers,
    updateEnrollmentSyncStatusQuery,
    healthCheck, checkPermissions,
    checkSubmodulePermissions,
    updateJourneyEnrollmentData,
    deleteEnrollmentData,
    selectPlatformUsers, findPlatformUserByEmailOrUsername, findPlatformUserByEmail, insertPlatformUserData,
    updatePlatformUserData, updatePlatformUserEstadoData, updatePlatformUserPhotoData, updatePlatformUserUsernameData,
    selectRoles, insertRoleData, updateRoleData,
    selectModulesAdmin, insertModuleData, updateModuleData,
    selectSubmodulesAdmin, insertSubmoduleData, updateSubmoduleData,
    selectRolePermissionsGrid, findRolePermission, insertRolePermissionData, deleteRolePermissionData,
    selectLabsGrades, insertLabGradeData,
    resolveSyncRule, updateCourseSyncFields, insertLogData, selectLogsData,
    updateUserNormalizedData, updateCourseNormalizedData,
    selectSyncRulesAdmin, selectSyncRuleById, findSyncRuleExactMatch, insertSyncRuleData,
    updateSyncRuleData, deleteSyncRuleData
} = require('./querysets');
 
const pool = new Pool({
    database: config.postgresql.database,
    user:     config.postgresql.user,
    password: config.postgresql.password,
    host:     config.postgresql.host,
    port:     config.postgresql.port,
});

// ─── GENÉRICO ─────────────────────────────────────────────────────────────────

function listAll(table) {
    return new Promise((resolve, reject) => {
        pool.query(selectAllItems(table), (err, data) => {
            if (err) return reject(err);
            resolve(data.rows);
        });
    });
}

function query(queryConfig) {
    return new Promise((resolve, reject) => {
        pool.query(queryConfig, (err, data) => {
            if (err) return reject(err);
            resolve(data.rows);
        });
    });
}

// ─── USERS ────────────────────────────────────────────────────────────────────

function insertUser(data) {
    return new Promise((resolve, reject) => {
        pool.query(insertUsuarioData(data), (err, result) => {
            if (err) return reject(err);
            resolve(result.rows);
        });
    });
}

function updateUser(data) {
    return new Promise((resolve, reject) => {
        pool.query(updateUsuarioData(data), (err, result) => {
            if (err) return reject(err);
            resolve(result.rows);
        });
    });
}

function updateJourneyUser(data) {
    return new Promise((resolve, reject) => {
        pool.query(updateUsuarioJourney(data), (err, result) => {
            if (err) return reject(err);
            resolve(result.rows);
        });
    });
}

function deleteUser(id) {
    return new Promise((resolve, reject) => {
        pool.query(deleteUsuarioData(id), (err, result) => {
            if (err) return reject(err);
            resolve(result.rows);
        });
    });
}

function getUsersForSync() {
    return new Promise((resolve, reject) => {
        pool.query(selectUsersForSync(), (err, data) => {
            if (err) return reject(err);
            resolve(data.rows);
        });
    });
}

function setUserMoodleId(id, moodleId) {
    return new Promise((resolve, reject) => {
        pool.query(updateUserMoodleId(id, moodleId), (err, data) => {
            if (err) return reject(err);
            resolve(data.rows);
        });
    });
}

function removeUserMoodleId(id) {
    return new Promise((resolve, reject) => {
        pool.query(clearUserMoodleId(id), (err, data) => {
            if (err) return reject(err);
            resolve(data.rows);
        });
    });
}

function findUserSicau(email, username) {
    return new Promise((resolve, reject) => {
        pool.query(findUserByEmailOrUsername(email, username), (err, data) => {
            if (err) return reject(err);
            resolve(data.rows);
        });
    });
}

function findUserByDoc(documento) {
    return new Promise((resolve, reject) => {
        pool.query(findUserByDocumento(documento), (err, data) => {
            if (err) return reject(err);
            resolve(data.rows);
        });
    });
}

function updateUserFromSicau(user) {
    return new Promise((resolve, reject) => {
        pool.query(updateUserSicau(user), (err, data) => {
            if (err) return reject(err);
            resolve(data.rows);
        });
    });
}

function updateUserSyncStatus(id, statusValue) {
    return new Promise((resolve, reject) => {
        pool.query(updateUserSyncStatusQuery(id, statusValue), (err, result) => {
            if (err) return reject(err);
            resolve(result.rows);
        });
    });
}

function updateUserUnsync(id) {
    return new Promise((resolve, reject) => {
        pool.query(updateUserUnsyncQuery(id), (err, result) => {
            if (err) return reject(err);
            resolve(result.rows);
        });
    });
}
function getEnrollmentsByUserId(userId) {
    return new Promise((resolve, reject) => {
        pool.query(selectEnrollmentsByUserId(userId), (err, data) => {
            if (err) return reject(err);
            resolve(data.rows);
        });
    });
}

function resetPassword(id, password) {
    return new Promise((resolve, reject) => {
        pool.query(updateUserPassword(id, password), (err, data) => {
            if (err) return reject(err);
            resolve(data.rows);
        });
    });
}

// ─── COURSES ──────────────────────────────────────────────────────────────────

function insertCourse(data) {
    return new Promise((resolve, reject) => {
        pool.query(insertCourseData(data), (err, result) => {
            if (err) return reject(err);
            resolve(result.rows);
        });
    });
}

function updateCourse(data) {
    return new Promise((resolve, reject) => {
        pool.query(updateCourseData(data), (err, result) => {
            if (err) return reject(err);
            resolve(result.rows);
        });
    });
}

function getCoursesForSync() {
    return new Promise((resolve, reject) => {
        pool.query(selectCoursesForSync(), (err, data) => {
            if (err) return reject(err);
            resolve(data.rows);
        });
    });
}

function getDistinctAsignaturas() {
    return new Promise((resolve, reject) => {
        pool.query(selectDistinctAsignaturas(), (err, data) => {
            if (err) return reject(err);
            resolve(data.rows);
        });
    });
}

function setCourseMoodleId(id, moodleId) {
    return new Promise((resolve, reject) => {
        pool.query(updateCourseMoodleId(id, moodleId), (err, data) => {
            if (err) return reject(err);
            resolve(data.rows);
        });
    });
}

function findCourseSicau(idnumber) {
    return new Promise((resolve, reject) => {
        pool.query(findCourseByIdnumber(idnumber), (err, data) => {
            if (err) return reject(err);
            resolve(data.rows);
        });
    });
}

function findCourseByShortnameFn(shortname) {
    return new Promise((resolve, reject) => {
        pool.query(findCourseByShortname(shortname), (err, data) => {
            if (err) return reject(err);
            resolve(data.rows);
        });
    });
}

function updateCourseSyncStatus(id, statusValue) {
    return new Promise((resolve, reject) => {
        pool.query(updateCourseSyncStatusQuery(id, statusValue), (err, result) => {
            if (err) return reject(err);
            resolve(result.rows);
        });
    });
}

function markCourseSyncing(id) {
    return new Promise((resolve, reject) => {
        pool.query(updateCourseSyncingQuery(id), (err, result) => {
            if (err) return reject(err);
            resolve(result.rows);
        });
    });
}

function markCourseSyncError(id, errorMessage) {
    return new Promise((resolve, reject) => {
        pool.query(updateCourseSyncErrorQuery(id, errorMessage), (err, result) => {
            if (err) return reject(err);
            resolve(result.rows);
        });
    });
}

function updateCourseFromSicau(id, fields) {
    return new Promise((resolve, reject) => {
        pool.query(updateCourseFromSicauQuery(id, fields), (err, result) => {
            if (err) return reject(err);
            resolve(result.rows);
        });
    });
}

function setCourseSyncFields(id, fields) {
    return new Promise((resolve, reject) => {
        pool.query(updateCourseSyncFields(id, fields), (err, result) => {
            if (err) return reject(err);
            resolve(result.rows);
        });
    });
}

// ─── SYNC RULES ─────────────────────────────────────────────────────────────────

function findSyncRule(codigoAsignatura, programa, departamento) {
    return new Promise((resolve, reject) => {
        pool.query(resolveSyncRule(codigoAsignatura, programa, departamento), (err, result) => {
            if (err) return reject(err);
            resolve(result.rows);
        });
    });
}

function findSyncRuleById(id) {
    return new Promise((resolve, reject) => {
        pool.query(selectSyncRuleById(id), (err, result) => {
            if (err) return reject(err);
            resolve(result.rows);
        });
    });
}

// ─── LOGS ───────────────────────────────────────────────────────────────────────

function insertLog(type, description, username, entityType, entityId) {
    return new Promise((resolve, reject) => {
        pool.query(insertLogData(type, description, username, entityType, entityId), (err, result) => {
            if (err) return reject(err);
            resolve(result.rows);
        });
    });
}

function listLogs(limit) {
    return new Promise((resolve, reject) => {
        pool.query(selectLogsData(limit), (err, result) => {
            if (err) return reject(err);
            resolve(result.rows);
        });
    });
}

// ─── NORMALIZACIÓN ────────────────────────────────────────────────────────────

function updateUserNormalized(id, fields) {
    return new Promise((resolve, reject) => {
        pool.query(updateUserNormalizedData(id, fields), (err, result) => {
            if (err) return reject(err);
            resolve(result.rows);
        });
    });
}

function updateCourseNormalized(id, fields) {
    return new Promise((resolve, reject) => {
        pool.query(updateCourseNormalizedData(id, fields), (err, result) => {
            if (err) return reject(err);
            resolve(result.rows);
        });
    });
}

// ─── SYNC RULES ADMIN ─────────────────────────────────────────────────────────────

function listSyncRulesAdmin() {
    return new Promise((resolve, reject) => {
        pool.query(selectSyncRulesAdmin(), (err, result) => {
            if (err) return reject(err);
            resolve(result.rows);
        });
    });
}

function findSyncRuleExact(codigoAsignatura, programa, departamento, excludeId) {
    return new Promise((resolve, reject) => {
        pool.query(findSyncRuleExactMatch(codigoAsignatura, programa, departamento, excludeId), (err, result) => {
            if (err) return reject(err);
            resolve(result.rows);
        });
    });
}

function insertSyncRuleAdmin(data) {
    return new Promise((resolve, reject) => {
        pool.query(insertSyncRuleData(data), (err, result) => {
            if (err) return reject(err);
            resolve(result.rows);
        });
    });
}

function updateSyncRuleAdmin(id, data) {
    return new Promise((resolve, reject) => {
        pool.query(updateSyncRuleData(id, data), (err, result) => {
            if (err) return reject(err);
            resolve(result.rows);
        });
    });
}

function deleteSyncRuleAdmin(id) {
    return new Promise((resolve, reject) => {
        pool.query(deleteSyncRuleData(id), (err, result) => {
            if (err) return reject(err);
            resolve(result.rows);
        });
    });
}

// ─── ENROLLMENTS ──────────────────────────────────────────────────────────────

function insertEnrollment(data) {
    return new Promise((resolve, reject) => {
        pool.query(insertEnrollmentData(data), (err, result) => {
            if (err) return reject(err);
            resolve(result.rows);
        });
    });
}

function updateEnrollment(data) {
    return new Promise((resolve, reject) => {
        pool.query(updateEnrollmentData(data), (err, result) => {
            if (err) return reject(err);
            resolve(result.rows);
        });
    });
}

function updateJourneyEnrollment(data) {
    return new Promise((resolve, reject) => {
        pool.query(updateJourneyEnrollmentData(data), (err, result) => {
            if (err) return reject(err);
            resolve(result.rows);
        });
    });
}

function deleteEnrollment(id) {
    return new Promise((resolve, reject) => {
        pool.query(deleteEnrollmentData(id), (err, result) => {
            if (err) return reject(err);
            resolve(result.rows);
        });
    });
}

function getEnrollmentsForSync() {
    return new Promise((resolve, reject) => {
        pool.query(selectEnrollmentsForSync(), (err, data) => {
            if (err) return reject(err);
            resolve(data.rows);
        });
    });
}

function setEnrollmentMoodleId(id, moodleEnrollmentId) {
    return new Promise((resolve, reject) => {
        pool.query(updateEnrollmentMoodleId(id, moodleEnrollmentId), (err, data) => {
            if (err) return reject(err);
            resolve(data.rows);
        });
    });
}

function findEnrollmentSicau(codigoJourney) {
    return new Promise((resolve, reject) => {
        pool.query(findEnrollmentByCodigoJourney(codigoJourney), (err, data) => {
            if (err) return reject(err);
            resolve(data.rows);
        });
    });
}

// ✅ nuevo: busca matrícula por usuario y código de curso
function findEnrollmentByUserAndCourseFn(userid, codigoJourney) {
    return new Promise((resolve, reject) => {
        pool.query(findEnrollmentByUserAndCourse(userid, codigoJourney), (err, data) => {
            if (err) return reject(err);
            resolve(data.rows);
        });
    });
}

function listAllEnrollmentsWithUsers() {
    return new Promise((resolve, reject) => {
        pool.query(findAllEnrollmentsWithUsers(), (err, data) => {
            if (err) return reject(err);
            resolve(data.rows);
        });
    });
}

function updateEnrollmentSyncStatus(id, statusValue) {
    return new Promise((resolve, reject) => {
        pool.query(updateEnrollmentSyncStatusQuery(id, statusValue), (err, result) => {
            if (err) return reject(err);
            resolve(result.rows);
        });
    });
}

function updateEnrollmentEstado(id, estado) {
    return new Promise((resolve, reject) => {
        pool.query(updateEnrollmentEstadoQuery(id, estado), (err, result) => {
            if (err) return reject(err);
            resolve(result.rows);
        });
    });
}

function setEnrollmentSyncFields(id, fields) {
    return new Promise((resolve, reject) => {
        pool.query(updateEnrollmentSyncFields(id, fields), (err, result) => {
            if (err) return reject(err);
            resolve(result.rows);
        });
    });
}

// ─── HEALTH ───────────────────────────────────────────────────────────────────

function checkDbConnection() {
    return new Promise((resolve, reject) => {
        pool.query(healthCheck(), (err) => {
            if (err) return reject(err);
            resolve(true);
        });
    });
}


// ─── ADMIN: PLATFORM USERS ──────────────────────────────────────────────────────

function listPlatformUsers() {
    return new Promise((resolve, reject) => {
        pool.query(selectPlatformUsers(), (err, data) => {
            if (err) return reject(err);
            resolve(data.rows);
        });
    });
}

function findPlatformUser(email, username) {
    return new Promise((resolve, reject) => {
        pool.query(findPlatformUserByEmailOrUsername(email, username), (err, data) => {
            if (err) return reject(err);
            resolve(data.rows);
        });
    });
}

function insertPlatformUser(data) {
    return new Promise((resolve, reject) => {
        pool.query(insertPlatformUserData(data), (err, result) => {
            if (err) return reject(err);
            resolve(result.rows);
        });
    });
}

function updatePlatformUser(id, data) {
    return new Promise((resolve, reject) => {
        pool.query(updatePlatformUserData(id, data), (err, result) => {
            if (err) return reject(err);
            resolve(result.rows);
        });
    });
}

function updatePlatformUserEstado(id, estado) {
    return new Promise((resolve, reject) => {
        pool.query(updatePlatformUserEstadoData(id, estado), (err, result) => {
            if (err) return reject(err);
            resolve(result.rows);
        });
    });
}

function findPlatformUserByEmailFn(email) {
    return new Promise((resolve, reject) => {
        pool.query(findPlatformUserByEmail(email), (err, data) => {
            if (err) return reject(err);
            resolve(data.rows);
        });
    });
}

function updatePlatformUserPhoto(email, photoUrl) {
    return new Promise((resolve, reject) => {
        pool.query(updatePlatformUserPhotoData(email, photoUrl), (err, result) => {
            if (err) return reject(err);
            resolve(result.rows);
        });
    });
}

function updatePlatformUserUsername(email, username) {
    return new Promise((resolve, reject) => {
        pool.query(updatePlatformUserUsernameData(email, username), (err, result) => {
            if (err) return reject(err);
            resolve(result.rows);
        });
    });
}

// ─── ADMIN: ROLES ────────────────────────────────────────────────────────────────

function listRoles() {
    return new Promise((resolve, reject) => {
        pool.query(selectRoles(), (err, data) => {
            if (err) return reject(err);
            resolve(data.rows);
        });
    });
}

function insertRole(data) {
    return new Promise((resolve, reject) => {
        pool.query(insertRoleData(data), (err, result) => {
            if (err) return reject(err);
            resolve(result.rows);
        });
    });
}

function updateRole(id, data) {
    return new Promise((resolve, reject) => {
        pool.query(updateRoleData(id, data), (err, result) => {
            if (err) return reject(err);
            resolve(result.rows);
        });
    });
}

// ─── ADMIN: MODULES ──────────────────────────────────────────────────────────────

function listModulesAdmin() {
    return new Promise((resolve, reject) => {
        pool.query(selectModulesAdmin(), (err, data) => {
            if (err) return reject(err);
            resolve(data.rows);
        });
    });
}

function insertModuleAdmin(data) {
    return new Promise((resolve, reject) => {
        pool.query(insertModuleData(data), (err, result) => {
            if (err) return reject(err);
            resolve(result.rows);
        });
    });
}

function updateModuleAdmin(id, data) {
    return new Promise((resolve, reject) => {
        pool.query(updateModuleData(id, data), (err, result) => {
            if (err) return reject(err);
            resolve(result.rows);
        });
    });
}

// ─── ADMIN: SUBMODULES ───────────────────────────────────────────────────────────

function listSubmodulesAdmin() {
    return new Promise((resolve, reject) => {
        pool.query(selectSubmodulesAdmin(), (err, data) => {
            if (err) return reject(err);
            resolve(data.rows);
        });
    });
}

function insertSubmoduleAdmin(data) {
    return new Promise((resolve, reject) => {
        pool.query(insertSubmoduleData(data), (err, result) => {
            if (err) return reject(err);
            resolve(result.rows);
        });
    });
}

function updateSubmoduleAdmin(id, data) {
    return new Promise((resolve, reject) => {
        pool.query(updateSubmoduleData(id, data), (err, result) => {
            if (err) return reject(err);
            resolve(result.rows);
        });
    });
}

// ─── ADMIN: ROLE PERMISSIONS ─────────────────────────────────────────────────────

function listRolePermissions() {
    return new Promise((resolve, reject) => {
        pool.query(selectRolePermissionsGrid(), (err, data) => {
            if (err) return reject(err);
            resolve(data.rows);
        });
    });
}

function findRolePermissionFn(role_id, submodule_id) {
    return new Promise((resolve, reject) => {
        pool.query(findRolePermission(role_id, submodule_id), (err, data) => {
            if (err) return reject(err);
            resolve(data.rows);
        });
    });
}

function grantRolePermission(data) {
    return new Promise((resolve, reject) => {
        pool.query(insertRolePermissionData(data), (err, result) => {
            if (err) return reject(err);
            resolve(result.rows);
        });
    });
}

function revokeRolePermission(role_id, submodule_id) {
    return new Promise((resolve, reject) => {
        pool.query(deleteRolePermissionData(role_id, submodule_id), (err, result) => {
            if (err) return reject(err);
            resolve(result.rows);
        });
    });
}

// ___ PERMISSIONS ______________________________________________________________

function checkPermissionsData(email) {
    return new Promise((resolve, reject) => {
        pool.query(checkPermissions(email), (err, result) => {
            if (err) return reject(err);
            resolve(result.rows);
        });
    });
}

function checkSubmodulesPermissionsData(email, submoduleCode) {
    return new Promise((resolve, reject) => {
        pool.query(checkSubmodulePermissions(email, submoduleCode), (err, result) => {
            if (err) return reject(err);
            resolve(result.rows);
        });
    });
}

// ___ VIRTUAL LABS ______________________________________________________________

function listLabsGrades() {
    return new Promise((resolve, reject) => {
        pool.query(selectLabsGrades(), (err, result) => {
            if (err) return reject(err);
            resolve(result.rows);
        });
    });
}

function insertLabGrade(data) {
    return new Promise((resolve, reject) => {
        pool.query(insertLabGradeData(data), (err, result) => {
            if (err) return reject(err);
            resolve(result.rows);
        });
    });
}

// ─── EXPORTS ──────────────────────────────────────────────────────────────────

module.exports = {
    listAll,
    query,
    insertUser,
    updateUser,
    updateJourneyUser,
    deleteUser,
    getUsersForSync,
    setUserMoodleId,
    removeUserMoodleId,
    findUserSicau,
    findUserByDoc,
    updateUserFromSicau,
    updateUserSyncStatus,
    updateUserUnsync,
    insertCourse,
    updateCourse,
    getCoursesForSync,
    getDistinctAsignaturas,
    setCourseMoodleId,
    findCourseSicau,
    findCourseByShortnameFn,
    updateCourseSyncStatus,
    markCourseSyncing,
    markCourseSyncError,
    updateCourseFromSicau,
    setCourseSyncFields,
    findSyncRule,
    findSyncRuleById,
    insertLog,
    listLogs,
    updateUserNormalized,
    updateCourseNormalized,
    listSyncRulesAdmin,
    findSyncRuleExact,
    insertSyncRuleAdmin,
    updateSyncRuleAdmin,
    deleteSyncRuleAdmin,
    insertEnrollment,
    updateEnrollment,
    updateJourneyEnrollment,
    deleteEnrollment,
    getEnrollmentsForSync,
    setEnrollmentMoodleId,
    findEnrollmentSicau,
    findEnrollmentByUserAndCourse: findEnrollmentByUserAndCourseFn,
    listAllEnrollmentsWithUsers,
    updateEnrollmentSyncStatus,
    updateEnrollmentEstado,
    setEnrollmentSyncFields,
    checkDbConnection,getEnrollmentsByUserId,
    resetPassword,
    checkPermissionsData,
    checkSubmodulesPermissionsData,
    // admin: platform users
    listPlatformUsers,
    findPlatformUser,
    insertPlatformUser,
    updatePlatformUser,
    updatePlatformUserEstado,
    findPlatformUserByEmail: findPlatformUserByEmailFn,
    updatePlatformUserPhoto,
    updatePlatformUserUsername,
    // admin: roles
    listRoles,
    insertRole,
    updateRole,
    // admin: modules
    listModulesAdmin,
    insertModuleAdmin,
    updateModuleAdmin,
    // admin: submodules
    listSubmodulesAdmin,
    insertSubmoduleAdmin,
    updateSubmoduleAdmin,
    // admin: role permissions
    listRolePermissions,
    findRolePermission: findRolePermissionFn,
    // virtual labs
    listLabsGrades,
    insertLabGrade,
    grantRolePermission,
    revokeRolePermission
};