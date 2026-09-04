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
    selectAllCourses, selectCoursesForSync, insertCourseData, updateCourseData,
    updateCourseMoodleId, findCourseByIdnumber, findCourseByShortname,
    updateCourseSyncStatusQuery,
    selectAllEnrollments, selectEnrollmentsForSync, insertEnrollmentData,
    updateEnrollmentData, updateEnrollmentMoodleId, findEnrollmentByCodigoJourney,
    findEnrollmentByUserAndCourse,
    updateEnrollmentEstadoQuery,
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
    selectRolePermissionsGrid, findRolePermission, insertRolePermissionData, deleteRolePermissionData
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
    setCourseMoodleId,
    findCourseSicau,
    findCourseByShortnameFn,
    updateCourseSyncStatus,
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
    grantRolePermission,
    revokeRolePermission
};