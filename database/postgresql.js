const config = require('../config');
const { Pool } = require('pg');
const { normalizeUser, normalizeCourse, normalizeEnrollment, normalizeEstado } = require('../services/normalize');
const {
    insertSicauNovedadData, selectSicauNovedades, findEnrollmentsByCodigoJourneyQuery,
    selectAllItems,
    selectAllUsers, selectUsersForSync, insertUsuarioData, updateUsuarioData,
    updateUsuarioJourney, deleteUsuarioData,
    updateUserMoodleId, clearUserMoodleId, findUserByEmailOrUsername,
    findUserByDocumento, findUserById, updateUserSicau,
    selectUserCompareFields, setUserCorreoPendienteQuery, setUserNovedadDatosQuery,
    clearUserCorreoPendienteQuery, archiveUserDocumentoQuery, applyCorreoPendienteQuery,
    updateUserSyncStatusQuery, updateUserUnsyncQuery,selectEnrollmentsByUserId,
    updateUserPassword,
    selectAllCourses, selectCoursesForSync, selectDistinctAsignaturas, insertCourseData, updateCourseData,
    updateCourseMoodleId, findCourseByIdnumber,
    updateCourseSyncStatusQuery, updateCourseSyncingQuery, updateCourseSyncErrorQuery,
    updateCourseFromSicauQuery,
    selectAllEnrollments, selectEnrollmentsForSync, insertEnrollmentData,
    updateEnrollmentData, updateEnrollmentMoodleId,
    findEnrollmentByUserAndCourse, findEnrollmentWithUserById,
    updateEnrollmentEstadoQuery, finalizeCourseEnrollmentsQuery, finalizePeriodoEnrollmentsQuery, updateEnrollmentSyncFields,
    updateEnrollmentSyncErrorQuery, updateEnrollmentEstadoSyncQuery, findEnrollmentByUserSubjectPeriod,
    findAllEnrollmentsWithUsers,
    updateEnrollmentSyncStatusQuery,
    healthCheck, checkPermissions,
    checkSubmodulePermissions,
    updateJourneyEnrollmentData,
    selectPlatformUsers, findPlatformUserByEmailOrUsername, findPlatformUserByEmail, insertPlatformUserData,
    updatePlatformUserData, updatePlatformUserEstadoData, updatePlatformUserPhotoData, updatePlatformUserUsernameData,
    updatePlatformUserLastLoginData,
    selectRoles, findRoleById, insertRoleData, updateRoleData,
    selectModulesAdmin, findModuleById, insertModuleData, updateModuleData,
    selectSubmodulesAdmin, insertSubmoduleData, updateSubmoduleData,
    selectRolePermissionsGrid, findRolePermission, insertRolePermissionData, deleteRolePermissionData, findSubmoduleById,
    selectLabsGrades, insertLabGradeData,
    selectFormsByUser, findFormById, findFormByIdAndUser, findFormByToken,
    insertFormData, updateFormData, updateFormStatusData, updateFormTokenData, softDeleteFormData,
    selectQuestionsByForm, insertQuestionData, updateQuestionData, softDeleteQuestionData,
    findResponseByIdentifier, insertResponseData, insertAnswerData, selectResponsesByForm,
    countFormResponses, deleteResponseData,
    selectFormsOwnedOrShared, selectAllFormsWithOwner, insertFormShareData, deleteFormShareData,
    selectFormSharesByForm, findFormShare, findPlatformUserByIdData, searchPlatformUsersForShare,
    resolveSyncRule, updateCourseSyncFields, insertLogData, selectLogsData, selectRecentModuleLogs,
    updateUserNormalizedData, updateCourseNormalizedData,
    selectSyncRulesAdmin, selectSyncRuleById, findSyncRuleExactMatch, insertSyncRuleData,
    updateSyncRuleData, deleteSyncRuleData,
    selectAllReports,
    selectReportById,
    insertReportData,
    updateReportData,
    deleteReportData,
    reportCoursesBySyncStatus: qReportCoursesBySyncStatus,
    reportCoursesSyncErrors: qReportCoursesSyncErrors,
    reportUsersNotSynced: qReportUsersNotSynced,
    reportEnrollmentsByStatus: qReportEnrollmentsByStatus,
    reportAuditActivity: qReportAuditActivity,
    reportPlatformUsersByRole: qReportPlatformUsersByRole,
    reportSyncRules: qReportSyncRules,
    reportVirtualLabsGrades: qReportVirtualLabsGrades,
    reportPermissionsMatrix: qReportPermissionsMatrix,
    reportCoursesForDiscrepancy: qReportCoursesForDiscrepancy,
    reportCourseById: qReportCourseById,
    reportCoursesDetail: qReportCoursesDetail,
    reportEnrollmentsDetail: qReportEnrollmentsDetail,
    reportPlatformUsersDetail: qReportPlatformUsersDetail,
    reportAuditDetail: qReportAuditDetail,
    reportEnrollmentsOfCourse: qReportEnrollmentsOfCourse,
    selectSettings, upsertSettingQuery, deleteSettingQuery,
    selectMenuLinks, selectAllMenuLinks, insertMenuLinkQuery, updateMenuLinkQuery, deleteMenuLinkQuery,
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

// users tiene índices únicos por documento, email y username (ver
// database/seeds/addUsersUniqueConstraints.js): traduce la violación a un 409
// con un mensaje entendible en vez del error crudo de Postgres.
function userDupError(err) {
    if (err.code !== '23505') return err;
    const campo = /documento/.test(err.constraint) ? 'documento'
        : /email/.test(err.constraint) ? 'email' : 'username';
    const dupErr = new Error(`Ya existe un usuario con ese ${campo}`);
    dupErr.statusCode = 409;
    return dupErr;
}

function insertUser(data) {
    return new Promise((resolve, reject) => {
        pool.query(insertUsuarioData({ ...data, ...normalizeUser(data) }), (err, result) => {
            if (err) return reject(userDupError(err));
            resolve(result.rows);
        });
    });
}

function updateUser(data) {
    return new Promise((resolve, reject) => {
        pool.query(updateUsuarioData({ ...data, ...normalizeUser(data) }), (err, result) => {
            if (err) return reject(userDupError(err));
            resolve(result.rows);
        });
    });
}

function updateJourneyUser(data) {
    return new Promise((resolve, reject) => {
        pool.query(updateUsuarioJourney({ ...data, ...normalizeUser(data) }), (err, result) => {
            if (err) return reject(userDupError(err));
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

function getUserById(id) {
    return new Promise((resolve, reject) => {
        pool.query(findUserById(id), (err, data) => {
            if (err) return reject(err);
            resolve(data.rows[0] || null);
        });
    });
}

function updateUserFromSicau(user) {
    return new Promise((resolve, reject) => {
        pool.query(updateUserSicau({ ...user, ...normalizeUser(user) }), (err, data) => {
            if (err) return reject(userDupError(err));
            resolve(data.rows);
        });
    });
}

function getUserCompareFields(id) {
    return new Promise((resolve, reject) => {
        pool.query(selectUserCompareFields(id), (err, data) => {
            if (err) return reject(err);
            resolve(data.rows);
        });
    });
}

function setUserCorreoPendiente(id, correo) {
    return new Promise((resolve, reject) => {
        pool.query(setUserCorreoPendienteQuery(id, correo), (err, result) => {
            if (err) return reject(err);
            resolve(result.rows);
        });
    });
}

function setUserNovedadDatos(id, cambios) {
    return new Promise((resolve, reject) => {
        pool.query(setUserNovedadDatosQuery(id, cambios), (err, result) => {
            if (err) return reject(err);
            resolve(result.rows);
        });
    });
}

function clearUserCorreoPendiente(id) {
    return new Promise((resolve, reject) => {
        pool.query(clearUserCorreoPendienteQuery(id), (err, result) => {
            if (err) return reject(err);
            resolve(result.rows);
        });
    });
}

function archiveUserDocumento(id) {
    return new Promise((resolve, reject) => {
        pool.query(archiveUserDocumentoQuery(id), (err, result) => {
            if (err) return reject(userDupError(err));
            resolve(result.rows);
        });
    });
}

function applyCorreoPendiente(id) {
    return new Promise((resolve, reject) => {
        pool.query(applyCorreoPendienteQuery(id), (err, result) => {
            if (err) return reject(userDupError(err));
            resolve(result.rows);
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
        pool.query(insertCourseData({ ...data, ...normalizeCourse(data) }), (err, result) => {
            if (err) return reject(err);
            resolve(result.rows);
        });
    });
}

function updateCourse(data) {
    return new Promise((resolve, reject) => {
        pool.query(updateCourseData({ ...data, ...normalizeCourse(data) }), (err, result) => {
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

function insertSicauNovedad(novedad) {
    return new Promise((resolve, reject) => {
        pool.query(insertSicauNovedadData(novedad), (err, result) => {
            if (err) return reject(err);
            resolve(result.rows);
        });
    });
}

function listSicauNovedades(limit) {
    return new Promise((resolve, reject) => {
        pool.query(selectSicauNovedades(limit), (err, result) => {
            if (err) return reject(err);
            resolve(result.rows);
        });
    });
}

function findEnrollmentsByCodigoJourney(codigoJourney) {
    return new Promise((resolve, reject) => {
        pool.query(findEnrollmentsByCodigoJourneyQuery(codigoJourney), (err, result) => {
            if (err) return reject(err);
            resolve(result.rows);
        });
    });
}

function insertLog(type, description, username, entityType, entityId, detail) {
    return new Promise((resolve, reject) => {
        pool.query(insertLogData(type, description, username, entityType, entityId, detail), (err, result) => {
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

function listRecentLogsByModule(moduleCode, limit) {
    return new Promise((resolve, reject) => {
        pool.query(selectRecentModuleLogs(moduleCode, limit), (err, result) => {
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
        pool.query(insertEnrollmentData({ ...data, ...normalizeEnrollment(data) }), (err, result) => {
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
        pool.query(updateJourneyEnrollmentData({ ...data, ...normalizeEnrollment(data) }), (err, result) => {
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

// ✅ nuevo: busca matrícula por usuario y código de curso
function findEnrollmentByUserAndCourseFn(userid, codigoJourney) {
    return new Promise((resolve, reject) => {
        pool.query(findEnrollmentByUserAndCourse(userid, codigoJourney), (err, data) => {
            if (err) return reject(err);
            resolve(data.rows);
        });
    });
}

function getEnrollmentWithUserById(id) {
    return new Promise((resolve, reject) => {
        pool.query(findEnrollmentWithUserById(id), (err, data) => {
            if (err) return reject(err);
            resolve(data.rows[0] || null);
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
        pool.query(updateEnrollmentEstadoQuery(id, normalizeEstado(estado)), (err, result) => {
            if (err) return reject(err);
            resolve(result.rows);
        });
    });
}

function finalizeCourseEnrollments(courseid) {
    return new Promise((resolve, reject) => {
        pool.query(finalizeCourseEnrollmentsQuery(courseid), (err, result) => {
            if (err) return reject(err);
            resolve(result.rows);
        });
    });
}

function finalizePeriodoEnrollments(periodo) {
    return new Promise((resolve, reject) => {
        pool.query(finalizePeriodoEnrollmentsQuery(periodo), (err, result) => {
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

function markEnrollmentSyncError(id, errorMessage) {
    return new Promise((resolve, reject) => {
        pool.query(updateEnrollmentSyncErrorQuery(id, errorMessage), (err, result) => {
            if (err) return reject(err);
            resolve(result.rows);
        });
    });
}

function updateEnrollmentEstadoSync(id, estadoSync) {
    return new Promise((resolve, reject) => {
        pool.query(updateEnrollmentEstadoSyncQuery(id, estadoSync), (err, result) => {
            if (err) return reject(err);
            resolve(result.rows);
        });
    });
}

function findEnrollmentByUserSubjectPeriodFn(userid, codigoAsignatura, periodo, excludeCodigoJourney) {
    return new Promise((resolve, reject) => {
        pool.query(findEnrollmentByUserSubjectPeriod(userid, codigoAsignatura, periodo, excludeCodigoJourney), (err, data) => {
            if (err) return reject(err);
            resolve(data.rows);
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

function updatePlatformUserLastLogin(email) {
    return new Promise((resolve, reject) => {
        pool.query(updatePlatformUserLastLoginData(email), (err, result) => {
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

function getRoleById(id) {
    return new Promise((resolve, reject) => {
        pool.query(findRoleById(id), (err, data) => {
            if (err) return reject(err);
            resolve(data.rows[0] || null);
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

function getModuleById(id) {
    return new Promise((resolve, reject) => {
        pool.query(findModuleById(id), (err, data) => {
            if (err) return reject(err);
            resolve(data.rows[0] || null);
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

function getSubmoduleById(id) {
    return new Promise((resolve, reject) => {
        pool.query(findSubmoduleById(id), (err, data) => {
            if (err) return reject(err);
            resolve(data.rows[0] || null);
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

// ─── SETTINGS ───────────────────────────────────────────────────────────────

function getSettings(categoria) {
    return new Promise((resolve, reject) => {
        pool.query(selectSettings(categoria), (err, data) => {
            if (err) return reject(err);
            resolve(data.rows);
        });
    });
}

function upsertSetting(categoria, clave, valor, updatedBy) {
    return new Promise((resolve, reject) => {
        pool.query(upsertSettingQuery(categoria, clave, valor, updatedBy), (err, result) => {
            if (err) return reject(err);
            resolve(result.rows[0]);
        });
    });
}

function deleteSetting(categoria, clave) {
    return new Promise((resolve, reject) => {
        pool.query(deleteSettingQuery(categoria, clave), (err, result) => {
            if (err) return reject(err);
            resolve(result.rows);
        });
    });
}

// ─── MENU_LINKS ─────────────────────────────────────────────────────────────

function getMenuLinks() {
    return new Promise((resolve, reject) => {
        pool.query(selectMenuLinks(), (err, data) => {
            if (err) return reject(err);
            resolve(data.rows);
        });
    });
}

function getAllMenuLinks() {
    return new Promise((resolve, reject) => {
        pool.query(selectAllMenuLinks(), (err, data) => {
            if (err) return reject(err);
            resolve(data.rows);
        });
    });
}

function insertMenuLink(link) {
    return new Promise((resolve, reject) => {
        pool.query(insertMenuLinkQuery(link), (err, result) => {
            if (err) return reject(err);
            resolve(result.rows[0]);
        });
    });
}

function updateMenuLink(id, link) {
    return new Promise((resolve, reject) => {
        pool.query(updateMenuLinkQuery(id, link), (err, result) => {
            if (err) return reject(err);
            resolve(result.rows[0]);
        });
    });
}

function deleteMenuLink(id) {
    return new Promise((resolve, reject) => {
        pool.query(deleteMenuLinkQuery(id), (err, result) => {
            if (err) return reject(err);
            resolve(result.rows);
        });
    });
}

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

// ─── ATTENDANCE FORMS ─────────────────────────────────────────────────────────

function listFormsByUser(userId) {
    return new Promise((resolve, reject) => {
        pool.query(selectFormsByUser(userId), (err, result) => {
            if (err) return reject(err);
            resolve(result.rows);
        });
    });
}

function getFormById(id) {
    return new Promise((resolve, reject) => {
        pool.query(findFormById(id), (err, result) => {
            if (err) return reject(err);
            resolve(result.rows[0] || null);
        });
    });
}

function getFormByIdAndUser(id, userId) {
    return new Promise((resolve, reject) => {
        pool.query(findFormByIdAndUser(id, userId), (err, result) => {
            if (err) return reject(err);
            resolve(result.rows[0] || null);
        });
    });
}

function getFormByToken(token) {
    return new Promise((resolve, reject) => {
        pool.query(findFormByToken(token), (err, result) => {
            if (err) return reject(err);
            resolve(result.rows[0] || null);
        });
    });
}

function insertForm(data) {
    return new Promise((resolve, reject) => {
        pool.query(insertFormData(data), (err, result) => {
            if (err) return reject(err);
            resolve(result.rows[0]);
        });
    });
}

function updateForm(id, data) {
    return new Promise((resolve, reject) => {
        pool.query(updateFormData(id, data), (err, result) => {
            if (err) return reject(err);
            resolve(result.rows[0]);
        });
    });
}

function updateFormStatus(id, status) {
    return new Promise((resolve, reject) => {
        pool.query(updateFormStatusData(id, status), (err, result) => {
            if (err) return reject(err);
            resolve(result.rows[0]);
        });
    });
}

function updateFormToken(id, token) {
    return new Promise((resolve, reject) => {
        pool.query(updateFormTokenData(id, token), (err, result) => {
            if (err) return reject(err);
            resolve(result.rows[0]);
        });
    });
}

function softDeleteForm(id) {
    return new Promise((resolve, reject) => {
        pool.query(softDeleteFormData(id), (err, result) => {
            if (err) return reject(err);
            resolve(result.rows[0]);
        });
    });
}

function listQuestionsByForm(formId) {
    return new Promise((resolve, reject) => {
        pool.query(selectQuestionsByForm(formId), (err, result) => {
            if (err) return reject(err);
            resolve(result.rows);
        });
    });
}

function insertQuestion(formId, q) {
    return new Promise((resolve, reject) => {
        pool.query(insertQuestionData(formId, q), (err, result) => {
            if (err) return reject(err);
            resolve(result.rows[0]);
        });
    });
}

function updateQuestion(id, q) {
    return new Promise((resolve, reject) => {
        pool.query(updateQuestionData(id, q), (err, result) => {
            if (err) return reject(err);
            resolve(result.rows[0]);
        });
    });
}

function softDeleteQuestion(id) {
    return new Promise((resolve, reject) => {
        pool.query(softDeleteQuestionData(id), (err, result) => {
            if (err) return reject(err);
            resolve(result.rows);
        });
    });
}

function getResponseByIdentifier(formId, identifier) {
    return new Promise((resolve, reject) => {
        pool.query(findResponseByIdentifier(formId, identifier), (err, result) => {
            if (err) return reject(err);
            resolve(result.rows[0] || null);
        });
    });
}

function insertResponse(formId, identifier, ipAddress) {
    return new Promise((resolve, reject) => {
        pool.query(insertResponseData(formId, identifier, ipAddress), (err, result) => {
            if (err) return reject(err);
            resolve(result.rows[0]);
        });
    });
}

function insertAnswer(responseId, questionId, value) {
    return new Promise((resolve, reject) => {
        pool.query(insertAnswerData(responseId, questionId, value), (err, result) => {
            if (err) return reject(err);
            resolve(result.rows[0]);
        });
    });
}

function listResponsesByForm(formId) {
    return new Promise((resolve, reject) => {
        pool.query(selectResponsesByForm(formId), (err, result) => {
            if (err) return reject(err);
            resolve(result.rows);
        });
    });
}

function countFormResponsesTotal(formId) {
    return new Promise((resolve, reject) => {
        pool.query(countFormResponses(formId), (err, result) => {
            if (err) return reject(err);
            resolve(result.rows[0]?.total || 0);
        });
    });
}

function deleteResponse(id) {
    return new Promise((resolve, reject) => {
        pool.query(deleteResponseData(id), (err, result) => {
            if (err) return reject(err);
            resolve(result.rows[0] || null);
        });
    });
}

function listFormsOwnedOrShared(userId) {
    return new Promise((resolve, reject) => {
        pool.query(selectFormsOwnedOrShared(userId), (err, result) => {
            if (err) return reject(err);
            resolve(result.rows);
        });
    });
}

function listAllFormsWithOwner(userId) {
    return new Promise((resolve, reject) => {
        pool.query(selectAllFormsWithOwner(userId), (err, result) => {
            if (err) return reject(err);
            resolve(result.rows);
        });
    });
}

function insertFormShare(formId, userId) {
    return new Promise((resolve, reject) => {
        pool.query(insertFormShareData(formId, userId), (err, result) => {
            if (err) return reject(err);
            resolve(result.rows[0] || null);
        });
    });
}

function deleteFormShare(formId, userId) {
    return new Promise((resolve, reject) => {
        pool.query(deleteFormShareData(formId, userId), (err, result) => {
            if (err) return reject(err);
            resolve(result.rows[0] || null);
        });
    });
}

function listFormShares(formId) {
    return new Promise((resolve, reject) => {
        pool.query(selectFormSharesByForm(formId), (err, result) => {
            if (err) return reject(err);
            resolve(result.rows);
        });
    });
}

function getFormShare(formId, userId) {
    return new Promise((resolve, reject) => {
        pool.query(findFormShare(formId, userId), (err, result) => {
            if (err) return reject(err);
            resolve(result.rows[0] || null);
        });
    });
}

function getPlatformUserById(id) {
    return new Promise((resolve, reject) => {
        pool.query(findPlatformUserByIdData(id), (err, result) => {
            if (err) return reject(err);
            resolve(result.rows[0] || null);
        });
    });
}

function searchPlatformUsersShare(q) {
    return new Promise((resolve, reject) => {
        pool.query(searchPlatformUsersForShare(q), (err, result) => {
            if (err) return reject(err);
            resolve(result.rows);
        });
    });
}

// ─── REPORTS ──────────────────────────────────────────────────────────────────

function listReports() {
    return new Promise((resolve, reject) => {
        pool.query(selectAllReports(), (err, data) => {
            if (err) return reject(err);
            resolve(data.rows);
        });
    });
}

function findReportById(id) {
    return new Promise((resolve, reject) => {
        pool.query(selectReportById(id), (err, data) => {
            if (err) return reject(err);
            resolve(data.rows[0] || null);
        });
    });
}

function insertReport(dataIn) {
    return new Promise((resolve, reject) => {
        pool.query(insertReportData(dataIn), (err, result) => {
            if (err) return reject(err);
            resolve(result.rows);
        });
    });
}

function updateReport(id, dataIn) {
    return new Promise((resolve, reject) => {
        pool.query(updateReportData(id, dataIn), (err, result) => {
            if (err) return reject(err);
            resolve(result.rows);
        });
    });
}

function deleteReport(id) {
    return new Promise((resolve, reject) => {
        pool.query(deleteReportData(id), (err, result) => {
            if (err) return reject(err);
            resolve(result.rows);
        });
    });
}

// ─── REPORTS: GENERADORES ─────────────────────────────────────────────────────

function reportCoursesBySyncStatus() {
    return new Promise((resolve, reject) => {
        pool.query(qReportCoursesBySyncStatus(), (err, data) => {
            if (err) return reject(err);
            resolve(data.rows);
        });
    });
}

function reportCoursesSyncErrors() {
    return new Promise((resolve, reject) => {
        pool.query(qReportCoursesSyncErrors(), (err, data) => {
            if (err) return reject(err);
            resolve(data.rows);
        });
    });
}

function reportUsersNotSynced() {
    return new Promise((resolve, reject) => {
        pool.query(qReportUsersNotSynced(), (err, data) => {
            if (err) return reject(err);
            resolve(data.rows);
        });
    });
}

function reportEnrollmentsByStatus() {
    return new Promise((resolve, reject) => {
        pool.query(qReportEnrollmentsByStatus(), (err, data) => {
            if (err) return reject(err);
            resolve(data.rows);
        });
    });
}

function reportAuditActivity({ dias, agruparPor }) {
    return new Promise((resolve, reject) => {
        pool.query(qReportAuditActivity({ dias, agruparPor }), (err, data) => {
            if (err) return reject(err);
            resolve(data.rows);
        });
    });
}

function reportPlatformUsersByRole() {
    return new Promise((resolve, reject) => {
        pool.query(qReportPlatformUsersByRole(), (err, data) => {
            if (err) return reject(err);
            resolve(data.rows);
        });
    });
}

function reportSyncRules() {
    return new Promise((resolve, reject) => {
        pool.query(qReportSyncRules(), (err, data) => {
            if (err) return reject(err);
            resolve(data.rows);
        });
    });
}

function reportVirtualLabsGrades({ agruparPor }) {
    return new Promise((resolve, reject) => {
        pool.query(qReportVirtualLabsGrades({ agruparPor }), (err, data) => {
            if (err) return reject(err);
            resolve(data.rows);
        });
    });
}

function reportPermissionsMatrix() {
    return new Promise((resolve, reject) => {
        pool.query(qReportPermissionsMatrix(), (err, data) => {
            if (err) return reject(err);
            resolve(data.rows);
        });
    });
}

function reportCoursesForDiscrepancy() {
    return new Promise((resolve, reject) => {
        pool.query(qReportCoursesForDiscrepancy(), (err, data) => {
            if (err) return reject(err);
            resolve(data.rows);
        });
    });
}

function reportCourseById(id) {
    return new Promise((resolve, reject) => {
        pool.query(qReportCourseById(id), (err, data) => {
            if (err) return reject(err);
            resolve(data.rows);
        });
    });
}

function reportCoursesDetail() {
    return new Promise((resolve, reject) => {
        pool.query(qReportCoursesDetail(), (err, data) => {
            if (err) return reject(err);
            resolve(data.rows);
        });
    });
}

function reportEnrollmentsDetail() {
    return new Promise((resolve, reject) => {
        pool.query(qReportEnrollmentsDetail(), (err, data) => {
            if (err) return reject(err);
            resolve(data.rows);
        });
    });
}

function reportPlatformUsersDetail() {
    return new Promise((resolve, reject) => {
        pool.query(qReportPlatformUsersDetail(), (err, data) => {
            if (err) return reject(err);
            resolve(data.rows);
        });
    });
}

function reportAuditDetail(params) {
    return new Promise((resolve, reject) => {
        pool.query(qReportAuditDetail(params), (err, data) => {
            if (err) return reject(err);
            resolve(data.rows);
        });
    });
}

function reportEnrollmentsOfCourse(courseid) {
    return new Promise((resolve, reject) => {
        pool.query(qReportEnrollmentsOfCourse(courseid), (err, data) => {
            if (err) return reject(err);
            resolve(data.rows);
        });
    });
}

// ─── EXPORTS ──────────────────────────────────────────────────────────────────

module.exports = {
    insertSicauNovedad,
    listSicauNovedades,
    findEnrollmentsByCodigoJourney,
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
    getUserById,
    updateUserFromSicau,
    getUserCompareFields,
    setUserCorreoPendiente,
    setUserNovedadDatos,
    clearUserCorreoPendiente,
    archiveUserDocumento,
    applyCorreoPendiente,
    updateUserSyncStatus,
    updateUserUnsync,
    insertCourse,
    updateCourse,
    getCoursesForSync,
    getDistinctAsignaturas,
    setCourseMoodleId,
    findCourseSicau,
    updateCourseSyncStatus,
    markCourseSyncing,
    markCourseSyncError,
    updateCourseFromSicau,
    setCourseSyncFields,
    findSyncRule,
    findSyncRuleById,
    insertLog,
    listLogs,
    listRecentLogsByModule,
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
    getEnrollmentsForSync,
    setEnrollmentMoodleId,
    findEnrollmentByUserAndCourse: findEnrollmentByUserAndCourseFn,
    getEnrollmentWithUserById,
    listAllEnrollmentsWithUsers,
    updateEnrollmentSyncStatus,
    updateEnrollmentEstado,
    finalizeCourseEnrollments,
    finalizePeriodoEnrollments,
    setEnrollmentSyncFields,
    markEnrollmentSyncError,
    updateEnrollmentEstadoSync,
    findEnrollmentByUserSubjectPeriod: findEnrollmentByUserSubjectPeriodFn,
    checkDbConnection,getEnrollmentsByUserId,
    resetPassword,
    checkPermissionsData,
    checkSubmodulesPermissionsData,
    getSettings,
    upsertSetting,
    deleteSetting,
    getMenuLinks,
    getAllMenuLinks,
    insertMenuLink,
    updateMenuLink,
    deleteMenuLink,
    // admin: platform users
    listPlatformUsers,
    findPlatformUser,
    insertPlatformUser,
    updatePlatformUser,
    updatePlatformUserEstado,
    findPlatformUserByEmail: findPlatformUserByEmailFn,
    updatePlatformUserPhoto,
    updatePlatformUserUsername,
    updatePlatformUserLastLogin,
    // admin: roles
    listRoles,
    insertRole,
    getRoleById,
    updateRole,
    // admin: modules
    listModulesAdmin,
    insertModuleAdmin,
    getModuleById,
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
    // attendance forms
    listFormsByUser,
    getFormById,
    getFormByIdAndUser,
    getFormByToken,
    insertForm,
    updateForm,
    updateFormStatus,
    updateFormToken,
    softDeleteForm,
    listQuestionsByForm,
    insertQuestion,
    updateQuestion,
    softDeleteQuestion,
    getResponseByIdentifier,
    insertResponse,
    insertAnswer,
    listResponsesByForm,
    countFormResponsesTotal,
    deleteResponse,
    listFormsOwnedOrShared,
    listAllFormsWithOwner,
    insertFormShare,
    deleteFormShare,
    listFormShares,
    getFormShare,
    getPlatformUserById,
    searchPlatformUsersShare,
    grantRolePermission,
    getSubmoduleById,
    revokeRolePermission,
    // reports
    listReports,
    findReportById,
    insertReport,
    updateReport,
    deleteReport,
    reportCoursesBySyncStatus,
    reportCoursesSyncErrors,
    reportUsersNotSynced,
    reportEnrollmentsByStatus,
    reportAuditActivity,
    reportPlatformUsersByRole,
    reportSyncRules,
    reportVirtualLabsGrades,
    reportPermissionsMatrix,
    reportCoursesForDiscrepancy,
    reportCourseById,
    reportCoursesDetail,
    reportEnrollmentsDetail,
    reportPlatformUsersDetail,
    reportAuditDetail,
    reportEnrollmentsOfCourse,
};