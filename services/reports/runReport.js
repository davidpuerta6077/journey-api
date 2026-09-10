// Registro de generadores de reporte. Cada valor es una función
// (params) => Promise<{ columns, rows, meta }>. Agregar un tipo = agregar
// una línea acá + su generador + su entrada en api/reports/tipos.js.
const generadores = {
    moodle_courses_by_category: require('./moodle/coursesByCategory').coursesByCategory,

    // Moodle (REST)
    moodle_students_at_risk_platform: require('./moodle/studentsAtRiskPlatform').studentsAtRiskPlatform,
    moodle_students_at_risk_course: require('./moodle/studentsAtRiskCourse').studentsAtRiskCourse,
    moodle_enrollment_by_course: require('./moodle/enrollmentByCourse').enrollmentByCourse,
    moodle_courses_without_students: require('./moodle/coursesWithoutStudents').coursesWithoutStudents,
    moodle_hidden_courses: require('./moodle/hiddenCourses').hiddenCourses,
    moodle_courses_without_teacher: require('./moodle/coursesWithoutTeacher').coursesWithoutTeacher,

    // Journey interno (Postgres)
    journey_courses_by_sync_status: require('./internal/coursesBySyncStatus').coursesBySyncStatus,
    journey_courses_sync_errors: require('./internal/coursesSyncErrors').coursesSyncErrors,
    journey_users_not_synced: require('./internal/usersNotSynced').usersNotSynced,
    journey_enrollments_by_status: require('./internal/enrollmentsByStatus').enrollmentsByStatus,
    journey_audit_activity: require('./internal/auditActivity').auditActivity,
    journey_platform_users_by_role: require('./internal/platformUsersByRole').platformUsersByRole,
    journey_sync_rules: require('./internal/syncRules').syncRules,
    journey_virtual_labs_grades: require('./internal/virtualLabsGrades').virtualLabsGrades,
    journey_permissions_matrix: require('./internal/permissionsMatrix').permissionsMatrix,

    // Cruces Moodle + Journey
    sync_discrepancies: require('./cross/syncDiscrepancies').syncDiscrepancies,
    enrollment_moodle_vs_journey: require('./cross/enrollmentMoodleVsJourney').enrollmentMoodleVsJourney,
};

async function runReport(tipo, params = {}) {
    const gen = generadores[tipo];
    if (!gen) {
        const err = new Error(`Tipo de reporte no soportado: ${tipo}`);
        err.status = 400;
        throw err;
    }
    return gen(params);
}

module.exports = { runReport };
