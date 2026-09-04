const config = require('../config');
const schema = config.postgresql.schema;

const selectAllItems = (table) => {
    return {
        text: `SELECT * FROM ${schema}.${table}`,
        values: []
    };
};

// ─── USERS ────────────────────────────────────────────────────────────────────

const selectAllUsers = () => ({
    text: `SELECT * FROM ${schema}.users`,
    values: []
});

const selectUsersForSync = () => ({
    text: `SELECT id, username, firstname, lastname, email, city, country,
           documento, correo_personal, telefono, celular, fecha_nacimiento,
           jornada, departamento_academico, plan_estudios, moodle_id, sincronizado,
           created_at
           FROM ${schema}.users 
           ORDER BY id DESC`,
    values: []
});

const insertUsuarioData = (data) => {
    const {
        username, firstname, lastname, email, password, city, country,
        documento, correo_personal, telefono, celular, fecha_nacimiento,
        jornada, departamento_academico, plan_estudios, moodle_id
    } = data;

    const text = `
        INSERT INTO ${schema}.users (
            username, firstname, lastname, email, password, city, country,
            documento, correo_personal, telefono, celular, fecha_nacimiento,
            jornada, departamento_academico, plan_estudios, moodle_id
        ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
        ) RETURNING *
    `;

    const values = [
        username, firstname, lastname, email, password,
        city || 'Medellín',
        country || 'CO',
        documento || null,
        correo_personal || null,
        telefono || null,
        celular || null,
        fecha_nacimiento || null,
        jornada || null,
        departamento_academico || null,
        plan_estudios || null,
        moodle_id || null
    ];

    return { text, values };
};

const updateUsuarioData = (data) => {
    const {
        id, firstname, lastname, city, country, password, moodle_id,
        documento, correo_personal, telefono, celular, fecha_nacimiento,
        jornada, departamento_academico, plan_estudios
    } = data;

    const text = `
        UPDATE ${schema}.users SET
            firstname = $1, lastname = $2, city = $3, country = $4, password = $5, moodle_id = $6,
            documento = $7, correo_personal = $8, telefono = $9, celular = $10,
            fecha_nacimiento = $11, jornada = $12, departamento_academico = $13,
            plan_estudios = $14
        WHERE id = $15
    `;

    const values = [
        firstname, lastname, city, country, password,
        moodle_id || null,
        documento || null,
        correo_personal || null,
        telefono || null,
        celular || null,
        fecha_nacimiento || null,
        jornada || null,
        departamento_academico || null,
        plan_estudios || null,
        id
    ];

    return { text, values };
};

const updateUsuarioJourney = (data) => {
    const {
        id, firstname, lastname, email, city, country,
        documento, correo_personal, telefono, celular,
        fecha_nacimiento, jornada, departamento_academico, plan_estudios
    } = data;

    const text = `
        UPDATE ${schema}.users SET
            firstname = $1, lastname = $2, email = $3, city = $4, country = $5,
            documento = $6, correo_personal = $7, telefono = $8, celular = $9,
            fecha_nacimiento = $10, jornada = $11, departamento_academico = $12,
            plan_estudios = $13
        WHERE id = $14
    `;

    const values = [
        firstname, lastname, email,
        city || 'Medellín',
        country || 'CO',
        documento || null,
        correo_personal || null,
        telefono || null,
        celular || null,
        fecha_nacimiento || null,
        jornada || null,
        departamento_academico || null,
        plan_estudios || null,
        id
    ];

    return { text, values };
};

const deleteUsuarioData = (id) => ({
    text: `DELETE FROM ${schema}.users WHERE id = $1`,
    values: [id]
});

const updateUserMoodleId = (id, moodleId) => ({
    text: `UPDATE ${schema}.users SET moodle_id = $1 WHERE id = $2`,
    values: [moodleId, id]
});

const clearUserMoodleId = (id) => ({
    text: `UPDATE ${schema}.users SET moodle_id = NULL WHERE id = $1`,
    values: [id]
});

const findUserByEmailOrUsername = (email, username) => ({
    text: `SELECT id, moodle_id, email FROM ${schema}.users WHERE email = $1 OR username = $2 LIMIT 1`,
    values: [email, username]
});

const findUserByDocumento = (documento) => ({
    text: `SELECT id FROM ${schema}.users WHERE documento = $1 LIMIT 1`,
    values: [documento]
});

const updateUserSicau = (data) => ({
    text: `UPDATE ${schema}.users SET
        firstname = $1, lastname = $2, city = $3, country = $4,
        documento = $5, correo_personal = $6, telefono = $7, celular = $8,
        fecha_nacimiento = $9, jornada = $10, departamento_academico = $11,
        plan_estudios = $12 WHERE email = $13 OR username = $14`,
    values: [
        data.firstname, data.lastname, data.city || 'Medellín', data.country || 'CO',
        data.documento || null, data.correo_personal || null,
        data.telefono || null, data.celular || null,
        data.fecha_nacimiento || null, data.jornada || null,
        data.departamento_academico || null, data.plan_estudios || null,
        data.email, data.username
    ]
});

function updateUserSyncStatusQuery(id, statusValue) {
    return {
        text: `UPDATE ${schema}.users SET sincronizado = $2 WHERE id = $1::integer`,
        values: [id, statusValue]
    };
}

// ✅ nuevo: revierte sincronización y limpia moodle_id
function updateUserUnsyncQuery(id) {
    return {
        text: `UPDATE ${schema}.users SET sincronizado = false, moodle_id = NULL WHERE id = $1::integer`,
        values: [id]
    };
}
const selectEnrollmentsByUserId = (userId) => ({
    text: `SELECT e.id, e.codigo_journey, e.nombre_asignatura, e.programa,
           e.periodo, e.grupo, e.role, e.sincronizado, e.estado,
           c.fullname, c.shortname, c.idnumber
           FROM ${schema}.enrollments e
           LEFT JOIN ${schema}.courses c ON c.id = e.courseid::integer
           WHERE e.userid = $1
           ORDER BY e.id DESC`,
    values: [userId]
});

const updateUserPassword = (id, password) => ({
    text: `UPDATE ${schema}.users SET password = $1 WHERE id = $2`,
    values: [password, id]
});

// ─── COURSES ──────────────────────────────────────────────────────────────────

const selectAllCourses = () => ({
    text: `SELECT * FROM ${schema}.courses`,
    values: []
});

const selectCoursesForSync = () => ({
    text: `SELECT id, fullname, shortname, categoryid, idnumber, summary, visible, format, 
           numsections, moodle_id, sincronizado, departamento, programa, docente, 
           fecha_inicio, fecha_fin, periodo, grupo, codigo_asignatura, nombre_asignatura, templatecourse
           FROM ${schema}.courses ORDER BY id DESC`,
    values: []
});

function updateCourseSyncStatusQuery(id, statusValue) {
    return {
        text: `UPDATE ${schema}.courses SET sincronizado = $2 WHERE id = $1::integer`,
        values: [id, statusValue]
    };
}

const insertCourseData = (data) => {
    const {
        fullname, shortname, categoryid, idnumber, summary,
        visible, format, numsections, moodle_id, seed_course_id,
        departamento, programa, docente, fecha_inicio, fecha_fin,
        periodo, grupo, codigo_asignatura, nombre_asignatura, templatecourse
    } = data;

    const text = `
        INSERT INTO ${schema}.courses (
            fullname, shortname, categoryid, idnumber, summary,
            visible, format, numsections, moodle_id, seed_course_id,
            departamento, programa, docente, fecha_inicio, fecha_fin,
            periodo, grupo, codigo_asignatura, nombre_asignatura, templatecourse
        ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
            $11, $12, $13, $14, $15, $16, $17, $18, $19, $20
        ) RETURNING *
    `;

    const values = [
        fullname,
        shortname,
        categoryid || null,
        idnumber || null,
        summary || null,
        visible == null ? true : visible,
        format || 'topics',
        numsections || 10,
        moodle_id || null,
        seed_course_id || null,
        departamento || null,
        programa || null,
        docente || null,
        fecha_inicio || null,
        fecha_fin || null,
        periodo || null,
        grupo || null,
        codigo_asignatura || null,
        nombre_asignatura || null,
        templatecourse || null
    ];

    return { text, values };
};

const updateCourseData = (data) => {
    const {
        id, fullname, categoryid, idnumber, summary,
        visible, format, numsections, moodle_id, seed_course_id
    } = data;

    const text = `
        UPDATE ${schema}.courses SET
            fullname = $1, categoryid = $2, idnumber = $3, summary = $4, visible = $5,
            format = $6, numsections = $7, moodle_id = $8, seed_course_id = $9
        WHERE id = $10
    `;

    const values = [
        fullname,
        categoryid || null,
        idnumber || null,
        summary || null,
        visible == null ? true : visible,
        format || 'topics',
        numsections || 10,
        moodle_id || null,
        seed_course_id || null,
        id
    ];

    return { text, values };
};

const updateCourseMoodleId = (id, moodleId) => ({
    text: `UPDATE ${schema}.courses SET moodle_id = $1 WHERE id = $2`,
    values: [moodleId, id]
});

const findCourseByIdnumber = (idnumber) => ({
    text: `SELECT * FROM ${schema}.courses WHERE idnumber = $1 LIMIT 1`,
    values: [idnumber]
});

const findCourseByShortname = (shortname) => ({
    text: `SELECT id FROM ${schema}.courses WHERE shortname = $1 LIMIT 1`,
    values: [shortname]
});

// ─── ENROLLMENTS ──────────────────────────────────────────────────────────────

const selectAllEnrollments = () => ({
    text: `SELECT * FROM ${schema}.enrollments`,
    values: []
});

const selectEnrollmentsForSync = () => ({
    text: `SELECT 
            e.id, e.userid, e.courseid, e.role, e.moodle_enrollment_id,
            e.codigo_asignatura, e.nombre_asignatura, e.programa,
            e.periodo, e.grupo, e.codigo_journey, e.estado,
            e.fecha_creacion_journey, e.sincronizado,
            u.firstname, u.lastname, u.email, u.documento, u.username,
            u.moodle_id AS user_moodle_id
           FROM ${schema}.enrollments e
           LEFT JOIN ${schema}.users u ON u.id = e.userid::integer
           ORDER BY e.id DESC`,
    values: []
});

const insertEnrollmentData = (data) => {
    const {
        userid, courseid, role, moodle_enrollment_id,
        codigo_asignatura, nombre_asignatura, programa,
        periodo, grupo, codigo_journey, estado, fecha_creacion_journey
    } = data;

    const text = `
        INSERT INTO ${schema}.enrollments (
            userid, courseid, role, moodle_enrollment_id,
            codigo_asignatura, nombre_asignatura, programa,
            periodo, grupo, codigo_journey, estado, fecha_creacion_journey
        ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
        ) RETURNING *
    `;

    const values = [
        userid,
        courseid,
        role || 'student',
        moodle_enrollment_id || null,
        codigo_asignatura || null,
        nombre_asignatura || null,
        programa || null,
        periodo || null,
        grupo || null,
        codigo_journey || null,
        estado || null,
        fecha_creacion_journey || null
    ];

    return { text, values };
};

const updateEnrollmentData = (data) => {
    const { id, moodle_enrollment_id } = data;

    const text = `
        UPDATE ${schema}.enrollments
        SET moodle_enrollment_id = $1
        WHERE id = $2
    `;

    const values = [
        moodle_enrollment_id || null,
        id
    ];

    return { text, values };
};

const updateEnrollmentMoodleId = (id, moodleEnrollmentId) => ({
    text: `UPDATE ${schema}.enrollments SET moodle_enrollment_id = $1 WHERE id = $2`,
    values: [moodleEnrollmentId, id]
});

const findEnrollmentByCodigoJourney = (codigoJourney) => ({
    text: `SELECT id FROM ${schema}.enrollments WHERE codigo_journey = $1 LIMIT 1`,
    values: [codigoJourney]
});

const findAllEnrollmentsWithUsers = () => ({
    text: `SELECT
        e.id, e.userid, e.courseid, e.role, e.moodle_enrollment_id,
        e.codigo_asignatura, e.nombre_asignatura, e.programa,
        e.periodo, e.grupo, e.codigo_journey, e.estado,
        e.fecha_creacion_journey, e.created_at, e.sincronizado,
        u.firstname, u.lastname, u.email, u.documento
    FROM ${schema}.enrollments e
    LEFT JOIN ${schema}.users u ON u.id = e.userid
    ORDER BY e.id DESC`,
    values: []
});

function updateEnrollmentSyncStatusQuery(id, statusValue) {
    return {
        text: `UPDATE ${schema}.enrollments SET sincronizado = $2 WHERE id = $1::integer`,
        values: [id, statusValue]
    };
}

const findEnrollmentByUserAndCourse = (userid, codigoJourney) => ({
    text: `SELECT id, role, courseid, moodle_enrollment_id, estado FROM ${schema}.enrollments WHERE userid = $1 AND codigo_journey = $2 LIMIT 1`,
    values: [userid, codigoJourney]
});

const updateEnrollmentEstadoQuery = (id, estado) => ({
    text: `UPDATE ${schema}.enrollments SET estado = $2 WHERE id = $1`,
    values: [id, estado]
});

const updateJourneyEnrollmentData = (data) => {
    const {
        id, userid, courseid, role,
        codigo_asignatura, nombre_asignatura, programa,
        periodo, grupo, estado
    } = data;

    const text = `
        UPDATE ${schema}.enrollments SET
            userid             = $1,
            courseid           = $2,
            role               = $3,
            codigo_asignatura  = $4,
            nombre_asignatura  = $5,
            programa           = $6,
            periodo            = $7,
            grupo              = $8,
            estado             = $9
        WHERE id = $10
        RETURNING *
    `;

    const values = [
        userid,
        courseid               || null,
        role                    || 'student',
        codigo_asignatura      || null,
        nombre_asignatura      || null,
        programa                || null,
        periodo                 || null,
        grupo                   || null,
        estado                  || null,
        id
    ];

    return { text, values };
};

const deleteEnrollmentData = (id) => ({
    text: `DELETE FROM ${schema}.enrollments WHERE id = $1`,
    values: [id]
});

// ─── MOODLE ───────────────────────────────────────────────────────────────────

const findMoodleUserByUsername = (username) => ({
    text: 'SELECT id, username FROM mdl_user WHERE username = ? AND deleted = 0 LIMIT 1',
    values: [username]
});

// ─── HEALTH ───────────────────────────────────────────────────────────────────

const healthCheck = () => ({
    text: `SELECT 1`,
    values: []
});


// ─── ADMIN: PLATFORM USERS ─────────────────────────────────────────────────────

const selectPlatformUsers = () => ({
    text: `SELECT u.id, u.username, u.email, u.estado, u.created_at, u.updated_at,
           u.last_login, u.created_by, u.role_id, u.photo_url, r.name AS role_name
           FROM ${schema}.platform_users u
           LEFT JOIN ${schema}.roles r ON r.id = u.role_id
           ORDER BY u.id`,
    values: []
});

const findPlatformUserByEmailOrUsername = (email, username) => ({
    text: `SELECT id FROM ${schema}.platform_users WHERE email = $1 OR username = $2 LIMIT 1`,
    values: [email, username]
});

const findPlatformUserByEmail = (email) => ({
    text: `SELECT u.id, u.username, u.email, u.estado, u.created_at, u.updated_at,
           u.last_login, u.role_id, u.photo_url, r.name AS role_name
           FROM ${schema}.platform_users u
           LEFT JOIN ${schema}.roles r ON r.id = u.role_id
           WHERE u.email = $1
           LIMIT 1`,
    values: [email]
});

const updatePlatformUserPhotoData = (email, photoUrl) => ({
    text: `UPDATE ${schema}.platform_users SET photo_url = $1, updated_at = now() WHERE email = $2 RETURNING *`,
    values: [photoUrl, email]
});

const insertPlatformUserData = (data) => {
    const { username, email, role_id, created_by } = data;
    const text = `
        INSERT INTO ${schema}.platform_users (username, email, role_id, created_by)
        VALUES ($1, $2, $3, $4)
        RETURNING *
    `;
    const values = [username, email, role_id || null, created_by || null];
    return { text, values };
};

const updatePlatformUserData = (id, data) => {
    const { username, role_id } = data;
    const text = `
        UPDATE ${schema}.platform_users
        SET username = $1, role_id = $2, updated_at = now()
        WHERE id = $3
        RETURNING *
    `;
    const values = [username, role_id || null, id];
    return { text, values };
};

const updatePlatformUserEstadoData = (id, estado) => ({
    text: `UPDATE ${schema}.platform_users SET estado = $1, updated_at = now() WHERE id = $2 RETURNING *`,
    values: [estado, id]
});

// ─── ADMIN: ROLES ───────────────────────────────────────────────────────────────

const selectRoles = () => ({
    text: `SELECT id, name, description, is_system_default, created_at
           FROM ${schema}.roles ORDER BY id`,
    values: []
});

const insertRoleData = (data) => {
    const { name, description } = data;
    const text = `
        INSERT INTO ${schema}.roles (name, description, is_system_default)
        VALUES ($1, $2, false)
        RETURNING *
    `;
    return { text, values: [name, description || null] };
};

const updateRoleData = (id, data) => {
    const { name, description } = data;
    const text = `
        UPDATE ${schema}.roles SET name = $1, description = $2
        WHERE id = $3
        RETURNING *
    `;
    return { text, values: [name, description || null, id] };
};

// ─── ADMIN: MODULES ─────────────────────────────────────────────────────────────

const selectModulesAdmin = () => ({
    text: `SELECT id, code, name, created_at FROM ${schema}.modules ORDER BY id`,
    values: []
});

const insertModuleData = (data) => {
    const { code, name } = data;
    const text = `
        INSERT INTO ${schema}.modules (code, name)
        VALUES ($1, $2)
        RETURNING *
    `;
    return { text, values: [code, name] };
};

const updateModuleData = (id, data) => {
    const { code, name } = data;
    const text = `
        UPDATE ${schema}.modules SET code = $1, name = $2
        WHERE id = $3
        RETURNING *
    `;
    return { text, values: [code, name, id] };
};

// ─── ADMIN: SUBMODULES ──────────────────────────────────────────────────────────

const selectSubmodulesAdmin = () => ({
    text: `SELECT s.id, s.module_id, s.code, s.name, s.created_at,
           m.code AS module_code, m.name AS module_name
           FROM ${schema}.submodules s
           JOIN ${schema}.modules m ON m.id = s.module_id
           ORDER BY s.module_id, s.id`,
    values: []
});

const insertSubmoduleData = (data) => {
    const { module_id, code, name } = data;
    const text = `
        INSERT INTO ${schema}.submodules (module_id, code, name)
        VALUES ($1, $2, $3)
        RETURNING *
    `;
    return { text, values: [module_id, code, name] };
};

const updateSubmoduleData = (id, data) => {
    const { module_id, code, name } = data;
    const text = `
        UPDATE ${schema}.submodules SET module_id = $1, code = $2, name = $3
        WHERE id = $4
        RETURNING *
    `;
    return { text, values: [module_id, code, name, id] };
};

// ─── ADMIN: ROLE PERMISSIONS ────────────────────────────────────────────────────

const selectRolePermissionsGrid = () => ({
    text: `SELECT role_id, submodule_id FROM ${schema}.role_permissions`,
    values: []
});

const findRolePermission = (role_id, submodule_id) => ({
    text: `SELECT id FROM ${schema}.role_permissions WHERE role_id = $1 AND submodule_id = $2 LIMIT 1`,
    values: [role_id, submodule_id]
});

const insertRolePermissionData = (data) => {
    const { role_id, submodule_id, granted_by } = data;
    const text = `
        INSERT INTO ${schema}.role_permissions (role_id, submodule_id, granted_by)
        VALUES ($1, $2, $3)
        RETURNING *
    `;
    return { text, values: [role_id, submodule_id, granted_by || null] };
};

const deleteRolePermissionData = (role_id, submodule_id) => ({
    text: `DELETE FROM ${schema}.role_permissions WHERE role_id = $1 AND submodule_id = $2`,
    values: [role_id, submodule_id]
});


// ___ PERMISSIONS ______________________________________________________________


const checkSubmodulePermissions = (email, submoduleCode) => ({
    text: `SELECT 1
        FROM ${schema}.platform_users u
        JOIN ${schema}.roles r ON r.id = u.role_id
        JOIN ${schema}.role_permissions rp ON rp.role_id = r.id
        JOIN ${schema}.submodules s ON s.id = rp.submodule_id
        WHERE u.email = $1 AND s.code = $2
        LIMIT 1;
      `,
    values: [email, submoduleCode]
});


const checkPermissions = (email) => ({
    text: `
    SELECT json_build_object(
        'role', r.name,
        'modules', (
            SELECT COALESCE(
                json_agg(
                    json_build_object(
                        'module_id', m.id,
                        'module_code', m.code,
                        'submodules', COALESCE(
                            (
                                SELECT json_agg(
                                    json_build_object(
                                        'submodule_id', s.id,
                                        'submodule_code', s.code
                                    ) ORDER BY s.id
                                )
                                FROM ${schema}.submodules s
                                INNER JOIN ${schema}.role_permissions rp ON rp.submodule_id = s.id
                                WHERE s.module_id = m.id
                                  AND rp.role_id = r.id
                            ),
                            '[]'::json
                        )
                    ) ORDER BY m.id
                ),
                '[]'::json
            )
            FROM ${schema}.modules m
        )
    ) AS user_permissions
    FROM ${schema}.platform_users u
    INNER JOIN ${schema}.roles r ON u.role_id = r.id
    WHERE u.email = $1
    `,
    values: [email]
});


// ─── EXPORTS ──────────────────────────────────────────────────────────────────



module.exports = {
    selectAllItems,
    // users
    selectAllUsers,
    selectUsersForSync,
    insertUsuarioData,
    updateUsuarioData,
    updateUsuarioJourney,
    deleteUsuarioData,
    updateUserMoodleId,
    clearUserMoodleId,
    findUserByEmailOrUsername,
    findUserByDocumento,
    updateUserSicau,
    updateUserSyncStatusQuery,
    updateUserUnsyncQuery,
    selectEnrollmentsByUserId,
    updateUserPassword,
    // courses
    selectAllCourses,
    selectCoursesForSync,
    insertCourseData,
    updateCourseData,
    updateCourseMoodleId,
    findCourseByIdnumber,
    findCourseByShortname,
    updateCourseSyncStatusQuery,
    // enrollments
    selectAllEnrollments,
    selectEnrollmentsForSync,
    insertEnrollmentData,
    updateEnrollmentData,
    updateEnrollmentMoodleId,
    findEnrollmentByCodigoJourney,
    findAllEnrollmentsWithUsers,
    findEnrollmentByUserAndCourse,
    updateEnrollmentEstadoQuery,
    updateEnrollmentSyncStatusQuery,
    updateJourneyEnrollmentData,
    deleteEnrollmentData,
    // moodle
    findMoodleUserByUsername,
    // health
    healthCheck,

    // admin: platform users
    selectPlatformUsers,
    findPlatformUserByEmailOrUsername,
    findPlatformUserByEmail,
    insertPlatformUserData,
    updatePlatformUserData,
    updatePlatformUserEstadoData,
    updatePlatformUserPhotoData,
    // admin: roles
    selectRoles,
    insertRoleData,
    updateRoleData,
    // admin: modules
    selectModulesAdmin,
    insertModuleData,
    updateModuleData,
    // admin: submodules
    selectSubmodulesAdmin,
    insertSubmoduleData,
    updateSubmoduleData,
    // admin: role permissions
    selectRolePermissionsGrid,
    findRolePermission,
    insertRolePermissionData,
    deleteRolePermissionData,

    //Permission
    checkPermissions,
    checkSubmodulePermissions
};