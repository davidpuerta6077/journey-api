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
           jornada, departamento_academico, plan_estudios, moodle_id
           FROM ${schema}.users ORDER BY id DESC`,
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
        city                   || 'Medellín',
        country                || 'CO',
        documento              || null,
        correo_personal        || null,
        telefono               || null,
        celular                || null,
        fecha_nacimiento       || null,
        jornada                || null,
        departamento_academico || null,
        plan_estudios          || null,
        moodle_id              || null
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
        moodle_id              || null,
        documento              || null,
        correo_personal        || null,
        telefono               || null,
        celular                || null,
        fecha_nacimiento       || null,
        jornada                || null,
        departamento_academico || null,
        plan_estudios          || null,
        id
    ];

    return { text, values };
};

const updateUserMoodleId = (id, moodleId) => ({
    text: `UPDATE ${schema}.users SET moodle_id = $1 WHERE id = $2`,
    values: [moodleId, id]
});

const clearUserMoodleId = (id) => ({
    text: `UPDATE ${schema}.users SET moodle_id = NULL WHERE id = $1`,
    values: [id]
});

const findUserByEmailOrUsername = (email, username) => ({
    text: `SELECT id FROM ${schema}.users WHERE email = $1 OR username = $2 LIMIT 1`,
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

// ─── COURSES ──────────────────────────────────────────────────────────────────

const selectAllCourses = () => ({
    text: `SELECT * FROM ${schema}.courses`,
    values: []
});

const selectCoursesForSync = () => ({
    text: `SELECT id, fullname, shortname, categoryid, idnumber, summary, visible, format, numsections, moodle_id
           FROM ${schema}.courses ORDER BY id DESC`,
    values: []
});

const insertCourseData = (data) => {
    const {
        fullname, shortname, categoryid, idnumber, summary,
        visible, format, numsections, moodle_id, seed_course_id
    } = data;

    const text = `
        INSERT INTO ${schema}.courses (
            fullname, shortname, categoryid, idnumber, summary,
            visible, format, numsections, moodle_id, seed_course_id
        ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
        ) RETURNING *
    `;

    const values = [
        fullname,
        shortname,
        categoryid     || null,
        idnumber       || null,
        summary        || null,
        visible == null ? true : visible,
        format         || 'topics',
        numsections    || 10,
        moodle_id      || null,
        seed_course_id || null
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
        categoryid     || null,
        idnumber       || null,
        summary        || null,
        visible == null ? true : visible,
        format         || 'topics',
        numsections    || 10,
        moodle_id      || null,
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
    text: `SELECT id FROM ${schema}.courses WHERE idnumber = $1 LIMIT 1`,
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
    text: `SELECT id, userid, courseid, role, moodle_enrollment_id FROM ${schema}.enrollments ORDER BY id DESC`,
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
        role                   || 'student',
        moodle_enrollment_id   || null,
        codigo_asignatura      || null,
        nombre_asignatura      || null,
        programa               || null,
        periodo                || null,
        grupo                  || null,
        codigo_journey         || null,
        estado                 || null,
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
        e.fecha_creacion_journey, e.created_at,
        u.firstname, u.lastname, u.email, u.documento
    FROM ${schema}.enrollments e
    LEFT JOIN ${schema}.users u ON u.id = e.userid
    ORDER BY e.id DESC`,
    values: []
});

// ─── HEALTH ───────────────────────────────────────────────────────────────────

const healthCheck = () => ({
    text: `SELECT 1`,
    values: []
});

// ─── EXPORTS ──────────────────────────────────────────────────────────────────

module.exports = {
    selectAllItems,
    // users
    selectAllUsers,
    selectUsersForSync,
    insertUsuarioData,
    updateUsuarioData,
    updateUserMoodleId,
    clearUserMoodleId,
    findUserByEmailOrUsername,
    findUserByDocumento,
    updateUserSicau,
    // courses
    selectAllCourses,
    selectCoursesForSync,
    insertCourseData,
    updateCourseData,
    updateCourseMoodleId,
    findCourseByIdnumber,
    findCourseByShortname,
    // enrollments
    selectAllEnrollments,
    selectEnrollmentsForSync,
    insertEnrollmentData,
    updateEnrollmentData,
    updateEnrollmentMoodleId,
    findEnrollmentByCodigoJourney,
    findAllEnrollmentsWithUsers,
    // health
    healthCheck
};