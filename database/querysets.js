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
           numsections, moodle_id, sincronizado, estado_sync, ultimo_error_sync,
           departamento, programa, docente,
           fecha_inicio, fecha_fin, periodo, grupo, codigo_asignatura, nombre_asignatura, templatecourse
           FROM ${schema}.courses ORDER BY id DESC`,
    values: []
});

// Catálogo de asignaturas ya conocidas (vistas en cursos sincronizados), para
// que el formulario de Reglas ofrezca un buscador/desplegable en vez de pedir
// que el usuario recuerde el código de memoria.
const selectDistinctAsignaturas = () => ({
    text: `
        SELECT codigo_asignatura, MAX(nombre_asignatura) AS nombre_asignatura
        FROM ${schema}.courses
        WHERE codigo_asignatura IS NOT NULL AND codigo_asignatura != ''
        GROUP BY codigo_asignatura
        ORDER BY codigo_asignatura
    `,
    values: []
});

function updateCourseSyncStatusQuery(id, statusValue) {
    return {
        text: `UPDATE ${schema}.courses
               SET sincronizado = $2,
                   estado_sync = $3,
                   ultimo_error_sync = CASE WHEN $2 THEN NULL ELSE ultimo_error_sync END
               WHERE id = $1::integer`,
        values: [id, statusValue, statusValue ? 'sincronizado' : 'error']
    };
}

// Estado intermedio mientras Moodle procesa la duplicación (puede tardar
// minutos con varias copias de la misma semilla en la misma corrida).
function updateCourseSyncingQuery(id) {
    return {
        text: `UPDATE ${schema}.courses SET estado_sync = 'sincronizando', ultimo_error_sync = NULL WHERE id = $1::integer`,
        values: [id]
    };
}

function updateCourseSyncErrorQuery(id, errorMessage) {
    return {
        text: `UPDATE ${schema}.courses
               SET sincronizado = false, estado_sync = 'error', ultimo_error_sync = $2
               WHERE id = $1::integer`,
        values: [id, errorMessage || null]
    };
}

// El nombre de la asignatura o el docente cambiaron en SICAU para un curso que
// ya existía localmente (mismo idnumber = codigo_asignatura+periodo+grupo, el
// código journey -único- de ese grupo en ese periodo). estado_sync lo decide
// el caller: "novedad" si el curso ya existe en Moodle (moodle_id, solo hace
// falta empujarle la metadata nueva desde Módulo Cursos) o "pendiente" si
// nunca se creó (todavía necesita el ciclo completo de duplicado en Sync
// Cursos, no un simple update).
function updateCourseFromSicauQuery(id, { docente, fullname, shortname, nombre_asignatura, estado_sync }) {
    return {
        text: `UPDATE ${schema}.courses
               SET docente = $2, fullname = $3, shortname = $4, nombre_asignatura = $5,
                   sincronizado = false, estado_sync = $6
               WHERE id = $1::integer`,
        values: [id, docente || null, fullname, shortname, nombre_asignatura || null, estado_sync]
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
    text: `SELECT id, docente FROM ${schema}.courses WHERE shortname = $1 LIMIT 1`,
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

// Usada por el sync de matrículas: re-vincula courseid (por si aún era null),
// guarda el id real de la matrícula en Moodle y marca sincronizado = true.
const updateEnrollmentSyncFields = (id, { courseid, moodle_enrollment_id, sincronizado }) => ({
    text: `
        UPDATE ${schema}.enrollments
        SET courseid = $1, moodle_enrollment_id = $2, sincronizado = $3
        WHERE id = $4
    `,
    values: [courseid || null, moodle_enrollment_id || null, sincronizado, id]
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

// El webservice manual de matriculación de Moodle no devuelve el id interno de la
// matrícula (mdl_user_enrolments.id); se lee directo de su BD tras enrolar/suspender.
// Esquema estándar de Moodle (mdl_user_enrolments/mdl_enrol), estable desde 2.x a 4.x.
const findMoodleEnrolmentId = (courseId, userId) => ({
    text: `
        SELECT ue.id
        FROM mdl_user_enrolments ue
        INNER JOIN mdl_enrol e ON e.id = ue.enrolid
        WHERE e.courseid = ? AND ue.userid = ? AND e.enrol = 'manual'
        ORDER BY ue.id DESC
        LIMIT 1
    `,
    values: [courseId, userId]
});

// Conteo de cursos y estudiantes (rol 'student') por categoría de Moodle.
// - categoryId null  => todas las categorías.
// - categoryId + incluirSubcategorias => la categoría indicada y todas las que
//   cuelgan de ella (mdl_course_categories.path, ej. "/1/5/12").
// Esquema estándar de Moodle (mdl_course/mdl_course_categories/mdl_context/
// mdl_role_assignments/mdl_role), estable de 2.x a 4.x.
const countCoursesStudentsByCategory = ({ categoryId = null, incluirSubcategorias = true }) => {
    const where = [];
    const values = [];
    if (categoryId != null) {
        if (incluirSubcategorias) {
            where.push(`(cc.id = ? OR cc.path LIKE CONCAT((SELECT path FROM mdl_course_categories WHERE id = ?), '/%'))`);
            values.push(categoryId, categoryId);
        } else {
            where.push(`cc.id = ?`);
            values.push(categoryId);
        }
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    return {
        text: `
            SELECT cc.id   AS categoria_id,
                   cc.name AS categoria,
                   cc.path AS path,
                   COUNT(DISTINCT c.id) AS cursos,
                   COUNT(DISTINCT CASE WHEN r.shortname = 'student' THEN ra.userid END) AS estudiantes
            FROM mdl_course_categories cc
            LEFT JOIN mdl_course c            ON c.category = cc.id AND c.id <> 1
            LEFT JOIN mdl_context ctx         ON ctx.instanceid = c.id AND ctx.contextlevel = 50
            LEFT JOIN mdl_role_assignments ra ON ra.contextid = ctx.id
            LEFT JOIN mdl_role r              ON r.id = ra.roleid
            ${whereSql}
            GROUP BY cc.id, cc.name, cc.path
            ORDER BY cc.name
        `,
        values
    };
};

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

const updatePlatformUserUsernameData = (email, username) => ({
    text: `UPDATE ${schema}.platform_users SET username = $1, updated_at = now() WHERE email = $2 RETURNING *`,
    values: [username, email]
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


// ___ VIRTUAL LABS ______________________________________________________________

const selectLabsGrades = () => ({
    text: `SELECT * FROM ${schema}.labs_grades ORDER BY id DESC`,
    values: []
});

const insertLabGradeData = (data) => {
    const { id_estudiante, correo, id_curso, calificacion } = data;
    const text = `
        INSERT INTO ${schema}.labs_grades (id_estudiante, correo, id_curso, calificacion)
        VALUES ($1, $2, $3, $4)
        RETURNING *
    `;
    return { text, values: [id_estudiante, correo, id_curso, calificacion] };
};


// ___ SYNC RULES ________________________________________________________________

// Resuelve la regla mas especifica que matchee: codigo_asignatura (peso 4) >
// programa+departamento (peso 3) > departamento solo (peso 1) > regla comodin
// con las tres columnas en NULL (peso 0), si existe.
const resolveSyncRule = (codigoAsignatura, programa, departamento) => ({
    text: `
        SELECT *,
            (CASE WHEN codigo_asignatura IS NOT NULL THEN 4 ELSE 0 END +
             CASE WHEN programa          IS NOT NULL THEN 2 ELSE 0 END +
             CASE WHEN departamento      IS NOT NULL THEN 1 ELSE 0 END) AS specificity
        FROM ${schema}.sync_rules
        WHERE activo = true
          AND (codigo_asignatura IS NULL OR codigo_asignatura = $1)
          AND (programa          IS NULL OR programa          = $2)
          AND (departamento      IS NULL OR departamento      = $3)
        ORDER BY specificity DESC, id ASC
        LIMIT 1
    `,
    values: [codigoAsignatura || null, programa || null, departamento || null]
});

// ___ SYNC RULES ADMIN (CRUD para /admin/reglas) _________________________________

const selectSyncRulesAdmin = () => ({
    text: `SELECT * FROM ${schema}.sync_rules ORDER BY id DESC`,
    values: []
});

// Regla puntual, elegida a mano por el usuario en Sync Cursos (en vez de dejar
// que se resuelva automáticamente por codigo_asignatura/programa/departamento).
const selectSyncRuleById = (id) => ({
    text: `SELECT * FROM ${schema}.sync_rules WHERE id = $1 AND activo = true LIMIT 1`,
    values: [id]
});

// Match exacto (no jerárquico) contra otras reglas activas, para evitar ambigüedad
// al crear/editar. excludeId se usa al editar, para no chocar contra sí misma.
const findSyncRuleExactMatch = (codigoAsignatura, programa, departamento, excludeId) => ({
    text: `
        SELECT id FROM ${schema}.sync_rules
        WHERE activo = true
          AND COALESCE(codigo_asignatura, '') = COALESCE($1, '')
          AND COALESCE(programa, '')          = COALESCE($2, '')
          AND COALESCE(departamento, '')      = COALESCE($3, '')
          AND ($4::integer IS NULL OR id != $4)
        LIMIT 1
    `,
    values: [codigoAsignatura || null, programa || null, departamento || null, excludeId || null]
});

const insertSyncRuleData = (data) => {
    const { codigo_asignatura, programa, departamento, seed_shortname, categoryid, activo } = data;
    return {
        text: `
            INSERT INTO ${schema}.sync_rules (codigo_asignatura, programa, departamento, seed_shortname, categoryid, activo)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
        `,
        values: [
            codigo_asignatura || null,
            programa || null,
            departamento || null,
            seed_shortname,
            categoryid,
            activo == null ? true : activo
        ]
    };
};

const updateSyncRuleData = (id, data) => {
    const { codigo_asignatura, programa, departamento, seed_shortname, categoryid, activo } = data;
    return {
        text: `
            UPDATE ${schema}.sync_rules
            SET codigo_asignatura = $1, programa = $2, departamento = $3,
                seed_shortname = $4, categoryid = $5, activo = $6, updated_at = now()
            WHERE id = $7
            RETURNING *
        `,
        values: [
            codigo_asignatura || null,
            programa || null,
            departamento || null,
            seed_shortname,
            categoryid,
            activo == null ? true : activo,
            id
        ]
    };
};

const deleteSyncRuleData = (id) => ({
    text: `DELETE FROM ${schema}.sync_rules WHERE id = $1`,
    values: [id]
});

// ___ COURSE SYNC (Moodle) _______________________________________________________

const updateCourseSyncFields = (id, { moodle_id, seed_course_id, categoryid }) => ({
    text: `
        UPDATE ${schema}.courses
        SET moodle_id = $1, seed_course_id = $2, categoryid = $3
        WHERE id = $4
    `,
    values: [moodle_id || null, seed_course_id || null, categoryid || null, id]
});

// ___ LOGS ________________________________________________________________________

const insertLogData = (type, description, username, entityType, entityId) => ({
    text: `
        INSERT INTO ${schema}.logs (type, description, username, entity_type, entity_id)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
    `,
    values: [type, description, username || null, entityType || null, entityId || null]
});

// entity_type guarda el código de submódulo (el mismo que checkPermission).
// Se resuelve contra submodules/modules: modules.name es la categoría principal
// del menú lateral (Journey Sync, Administrador, ...) y submodules.name el módulo.
// El front puede afinar el nombre con el árbol del menú (menuItems).
const selectLogsData = (limit) => ({
    text: `
        SELECT l.id,
               l.date,
               l.type,
               l.description,
               l.username,
               l.entity_type,
               m.name  AS aplicacion,
               sm.name AS modulo
        FROM ${schema}.logs l
        LEFT JOIN ${schema}.submodules sm ON sm.code = l.entity_type
        LEFT JOIN ${schema}.modules m ON m.id = sm.module_id
        ORDER BY l.date DESC
        LIMIT $1
    `,
    values: [limit]
});

// ___ NORMALIZACIÓN ______________________________________________________________
// Updates acotados a los campos que se normalizan antes de sincronizar, para no
// interferir con updateUsuarioData / updateCourseData.

const updateUserNormalizedData = (id, { firstname, lastname, email, correo_personal }) => ({
    text: `
        UPDATE ${schema}.users
        SET firstname = $1, lastname = $2, email = $3, correo_personal = $4
        WHERE id = $5
    `,
    values: [firstname, lastname, email, correo_personal ?? null, id]
});

const updateCourseNormalizedData = (id, { fullname, shortname, nombre_asignatura }) => ({
    text: `
        UPDATE ${schema}.courses
        SET fullname = $1, shortname = $2, nombre_asignatura = $3
        WHERE id = $4
    `,
    values: [fullname, shortname, nombre_asignatura ?? null, id]
});


// ─── REPORTS ──────────────────────────────────────────────────────────────────

const selectAllReports = () => ({
    text: `SELECT * FROM ${schema}.reports ORDER BY created_at DESC`,
    values: []
});

const selectReportById = (id) => ({
    text: `SELECT * FROM ${schema}.reports WHERE id = $1`,
    values: [id]
});

const insertReportData = ({ nombre, tipo, params, descripcion, created_by }) => ({
    text: `
        INSERT INTO ${schema}.reports (nombre, tipo, params, descripcion, created_by)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
    `,
    values: [nombre, tipo, params ?? {}, descripcion ?? null, created_by ?? null]
});

const updateReportData = (id, { nombre, params, descripcion }) => ({
    text: `
        UPDATE ${schema}.reports
        SET nombre = $1, params = $2, descripcion = $3, updated_at = now()
        WHERE id = $4
        RETURNING *
    `,
    values: [nombre, params ?? {}, descripcion ?? null, id]
});

const deleteReportData = (id) => ({
    text: `DELETE FROM ${schema}.reports WHERE id = $1`,
    values: [id]
});

// SQL de los generadores del módulo Reportes (services/reports/). Los wrappers
// Promise viven en postgresql.js; los generadores llaman db.reportX(...).

const reportCoursesBySyncStatus = () => ({
    text: `SELECT COALESCE(estado_sync,'(sin estado)') AS estado, COUNT(*)::int AS cantidad
           FROM ${schema}.courses GROUP BY 1 ORDER BY cantidad DESC`,
    values: []
});

const reportCoursesSyncErrors = () => ({
    text: `SELECT id, shortname, fullname, estado_sync, ultimo_error_sync
           FROM ${schema}.courses
           WHERE estado_sync = 'error' OR (ultimo_error_sync IS NOT NULL AND ultimo_error_sync <> '')
           ORDER BY id DESC`,
    values: []
});

const reportUsersNotSynced = () => ({
    text: `SELECT id, username, firstname, lastname, email, moodle_id, sincronizado
           FROM ${schema}.users
           WHERE sincronizado IS NOT TRUE OR moodle_id IS NULL
           ORDER BY id DESC`,
    values: []
});

const reportEnrollmentsByStatus = () => ({
    text: `SELECT COALESCE(estado,'(sin estado)') AS estado, COALESCE(sincronizado,false) AS sincronizado, COUNT(*)::int AS cantidad
           FROM ${schema}.enrollments GROUP BY 1,2 ORDER BY cantidad DESC`,
    values: []
});

// Dinámico por agruparPor (igual que countCoursesStudentsByCategory). dias va
// por values; agruparPor elige el text por rama, nunca se interpola.
const reportAuditActivity = ({ dias, agruparPor }) => {
    let text;
    if (agruparPor === 'modulo') {
        text = `SELECT COALESCE(m.name,'(sin módulo)') AS aplicacion,
                       COALESCE(sm.name, l.entity_type, '(sin submódulo)') AS modulo,
                       COUNT(*)::int AS acciones
                FROM ${schema}.logs l
                LEFT JOIN ${schema}.submodules sm ON sm.code = l.entity_type
                LEFT JOIN ${schema}.modules m ON m.id = sm.module_id
                WHERE l.date >= now() - ($1 || ' days')::interval
                GROUP BY 1,2 ORDER BY acciones DESC`;
    } else if (agruparPor === 'dia') {
        text = `SELECT to_char(date_trunc('day', date),'YYYY-MM-DD') AS dia, COUNT(*)::int AS acciones
                FROM ${schema}.logs
                WHERE date >= now() - ($1 || ' days')::interval
                GROUP BY 1 ORDER BY dia DESC`;
    } else {
        text = `SELECT COALESCE(username,'(anónimo)') AS usuario, COUNT(*)::int AS acciones
                FROM ${schema}.logs
                WHERE date >= now() - ($1 || ' days')::interval
                GROUP BY 1 ORDER BY acciones DESC`;
    }
    return { text, values: [String(dias)] };
};

const reportPlatformUsersByRole = () => ({
    text: `SELECT r.name AS rol,
                  COUNT(pu.id)::int AS usuarios,
                  (COUNT(pu.id) FILTER (WHERE pu.estado IS TRUE))::int AS activos,
                  (COUNT(pu.id) FILTER (WHERE pu.last_login IS NOT NULL))::int AS con_ingreso
           FROM ${schema}.roles r
           LEFT JOIN ${schema}.platform_users pu ON pu.role_id = r.id
           GROUP BY r.name ORDER BY usuarios DESC`,
    values: []
});

const reportSyncRules = () => ({
    text: `SELECT sr.id, sr.codigo_asignatura, sr.programa, sr.departamento, sr.seed_shortname,
                  sr.categoryid, sr.activo, COUNT(c.id)::int AS cursos_asociados
           FROM ${schema}.sync_rules sr
           LEFT JOIN ${schema}.courses c ON c.codigo_asignatura = sr.codigo_asignatura
           GROUP BY sr.id ORDER BY sr.activo DESC, sr.id`,
    values: []
});

// Dinámico por agruparPor.
const reportVirtualLabsGrades = ({ agruparPor }) => {
    let text;
    if (agruparPor === 'estudiante') {
        text = `SELECT id_estudiante, correo, COUNT(*)::int AS calificaciones,
                       ROUND(AVG(calificacion)::numeric,2) AS promedio
                FROM ${schema}.labs_grades
                GROUP BY id_estudiante, correo ORDER BY promedio DESC NULLS LAST`;
    } else if (agruparPor === 'detalle') {
        text = `SELECT id, id_estudiante, correo, id_curso, calificacion, created_at
                FROM ${schema}.labs_grades ORDER BY created_at DESC`;
    } else {
        text = `SELECT id_curso, COUNT(*)::int AS calificaciones,
                       ROUND(AVG(calificacion)::numeric,2) AS promedio,
                       MIN(calificacion) AS minima, MAX(calificacion) AS maxima
                FROM ${schema}.labs_grades GROUP BY id_curso ORDER BY id_curso`;
    }
    return { text, values: [] };
};

const reportPermissionsMatrix = () => ({
    text: `SELECT r.name AS rol, m.name AS aplicacion, sm.name AS submodulo
           FROM ${schema}.role_permissions rp
           JOIN ${schema}.roles r ON r.id = rp.role_id
           JOIN ${schema}.submodules sm ON sm.id = rp.submodule_id
           JOIN ${schema}.modules m ON m.id = sm.module_id
           ORDER BY r.name, m.name, sm.name`,
    values: []
});

// syncDiscrepancies: solo el SELECT de courses; la comparación se queda en el generador.
const reportCoursesForDiscrepancy = () => ({
    text: `SELECT id, shortname, moodle_id, estado_sync FROM ${schema}.courses`,
    values: []
});

const reportCourseById = (id) => ({
    text: `SELECT id, shortname, moodle_id FROM ${schema}.courses WHERE id = $1`,
    values: [id]
});

const reportEnrollmentCountByCourse = (courseid) => ({
    text: `SELECT COUNT(*)::int AS n FROM ${schema}.enrollments WHERE courseid = $1`,
    values: [courseid]
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
    selectDistinctAsignaturas,
    insertCourseData,
    updateCourseData,
    updateCourseMoodleId,
    findCourseByIdnumber,
    findCourseByShortname,
    updateCourseSyncStatusQuery,
    updateCourseSyncingQuery,
    updateCourseSyncErrorQuery,
    updateCourseFromSicauQuery,
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
    updateEnrollmentSyncFields,
    updateEnrollmentSyncStatusQuery,
    updateJourneyEnrollmentData,
    deleteEnrollmentData,
    // moodle
    findMoodleUserByUsername,
    findMoodleEnrolmentId,
    countCoursesStudentsByCategory,
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
    updatePlatformUserUsernameData,
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
    // virtual labs
    selectLabsGrades,
    insertLabGradeData,
    // sync rules
    resolveSyncRule,
    updateCourseSyncFields,
    selectSyncRulesAdmin,
    selectSyncRuleById,
    findSyncRuleExactMatch,
    insertSyncRuleData,
    updateSyncRuleData,
    deleteSyncRuleData,
    // logs
    insertLogData,
    selectLogsData,
    // normalización
    updateUserNormalizedData,
    updateCourseNormalizedData,
    // reports
    selectAllReports,
    selectReportById,
    insertReportData,
    updateReportData,
    deleteReportData,
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
    reportEnrollmentCountByCourse,

    //Permission
    checkPermissions,
    checkSubmodulePermissions
};