const config = require('../config');
const schema = config.postgresql.schema;


const selectAllItems = (table) => {
    return {
        text: `SELECT * FROM ${table}`,
        values: []
    };
};
// ─── USERS ────────────────────────────────────────────────────────────────────
const selectAllUsers = () => ({
    query: `SELECT * FROM ${schema}.users`,
    values: []
});

const insertUsuarioData = (table, data) => {
    const {
        username, firstname, lastname, email, password, city, country,
        documento, correo_personal, telefono, celular, fecha_nacimiento,
        jornada, departamento_academico, plan_estudios, moodle_id
    } = data;

    const query = `
        INSERT INTO ${schema}.${table} (
            username, firstname, lastname, email, password, city, country,
            documento, correo_personal, telefono, celular, fecha_nacimiento,
            jornada, departamento_academico, plan_estudios, moodle_id
        ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
        )
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

    return { query, values };
};

const updateUsuarioData = (data) => {
    const {
        id, firstname, lastname, city, country, password, moodle_id,
        documento, correo_personal, telefono, celular, fecha_nacimiento,
        jornada, departamento_academico, plan_estudios
    } = data;

    const query = `
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

    return { query, values };
};

const findUserByEmailOrUsername = (email, username) => ({
    query: `SELECT id FROM ${schema}.users WHERE email = $1 OR username = $2 LIMIT 1`,
    values: [email, username]
});

const findUserByDocumento = (documento) => ({
    query: `SELECT id FROM ${schema}.users WHERE documento = $1 LIMIT 1`,
    values: [documento]
});

const updateUserSicau = (data) => ({
    query: `UPDATE ${schema}.users SET
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
    query: `SELECT * FROM ${schema}.courses`,
    values: []
});

const insertCourseData = (data) => {
    const {
        fullname, shortname, categoryid, idnumber, summary,
        visible, format, numsections, moodle_id, seed_course_id
    } = data;

    const query = `
        INSERT INTO ${schema}.courses (
            fullname, shortname, categoryid, idnumber, summary,
            visible, format, numsections, moodle_id, seed_course_id
        ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
        )
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

    return { query, values };
};

const updateCourseData = (data) => {
    const {
        id, fullname, categoryid, idnumber, summary,
        visible, format, numsections, moodle_id, seed_course_id
    } = data;

    const query = `
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

    return { query, values };
};

const findCourseByIdnumber = (idnumber) => ({
    query: `SELECT id FROM ${schema}.courses WHERE idnumber = $1 LIMIT 1`,
    values: [idnumber]
});

// ─── ENROLLMENTS ──────────────────────────────────────────────────────────────

const selectAllEnrollments = () => ({
    query: `SELECT * FROM ${schema}.enrollments`,
    values: []
});

const insertEnrollmentData = (data) => {
    const {
        userid, courseid, role, moodle_enrollment_id,
        codigo_asignatura, nombre_asignatura, programa,
        periodo, grupo, codigo_journey, estado, fecha_creacion_journey
    } = data;

    const query = `
        INSERT INTO ${schema}.enrollments (
            userid, courseid, role, moodle_enrollment_id,
            codigo_asignatura, nombre_asignatura, programa,
            periodo, grupo, codigo_journey, estado, fecha_creacion_journey
        ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
        )
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

    return { query, values };
};

const updateEnrollmentData = (data) => {
    const { id, moodle_enrollment_id } = data;

    const query = `
        UPDATE ${schema}.enrollments 
        SET moodle_enrollment_id = $1 
        WHERE id = $2
    `;

    const values = [
        moodle_enrollment_id || null, 
        id
    ];

    return { query, values };
};

const findEnrollmentByCodigoJourney = (codigoJourney) => ({
    query: `SELECT id FROM ${schema}.enrollments WHERE codigo_journey = $1 LIMIT 1`,
    values: [codigoJourney]
});

const findAllEnrollmentsWithUsers = () => ({
    query: `SELECT 
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

// ─── EXPORTS ──────────────────────────────────────────────────────────────────

module.exports = {
    selectAllItems,
    // users
    selectAllUsers,
    insertUsuarioData,
    updateUsuarioData,
    findUserByEmailOrUsername,
    findUserByDocumento,
    updateUserSicau,
    // courses
    selectAllCourses,
    insertCourseData,
    updateCourseData,
    findCourseByIdnumber,
    // enrollments
    selectAllEnrollments,
    insertEnrollmentData,
    updateEnrollmentData,
    findEnrollmentByCodigoJourney,
    findAllEnrollmentsWithUsers
};