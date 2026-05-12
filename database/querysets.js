const selectAllItems = (table) => {
    return {
        text: `SELECT * FROM ${table}`,
        values: []
    };
};

const insertData = (table, jsonData) => {
    if (table === 'users') {
        const {
            username, firstname, lastname, email, password, city, country,
            documento, correo_personal, telefono, celular, fecha_nacimiento,
            jornada, departamento_academico, plan_estudios, moodle_id
        } = jsonData;
        return {
            text: `INSERT INTO users (
                username, firstname, lastname, email, password, city, country,
                documento, correo_personal, telefono, celular, fecha_nacimiento,
                jornada, departamento_academico, plan_estudios, moodle_id
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *`,
            values: [
                username, firstname, lastname, email, password,
                city || 'Medellín', country || 'CO',
                documento || null, correo_personal || null,
                telefono || null, celular || null,
                fecha_nacimiento || null, jornada || null,
                departamento_academico || null, plan_estudios || null,
                moodle_id || null
            ]
        };
    } else if (table === 'enrollments') {
        const {
            userid, courseid, role, moodle_enrollment_id,
            codigo_asignatura, nombre_asignatura, programa,
            periodo, grupo, codigo_journey, estado, fecha_creacion_journey
        } = jsonData;
        return {
            text: `INSERT INTO enrollments (
                userid, courseid, role, moodle_enrollment_id,
                codigo_asignatura, nombre_asignatura, programa,
                periodo, grupo, codigo_journey, estado, fecha_creacion_journey
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
            values: [
                userid, courseid, role || 'student', moodle_enrollment_id || null,
                codigo_asignatura || null, nombre_asignatura || null, programa || null,
                periodo || null, grupo || null, codigo_journey || null,
                estado || null, fecha_creacion_journey || null
            ]
        };
    } else if (table === 'courses') {
        const { fullname, shortname, categoryid, idnumber, summary, visible, format, numsections, moodle_id, seed_course_id } = jsonData;
        return {
            text: `INSERT INTO courses (fullname, shortname, categoryid, idnumber, summary, visible, format, numsections, moodle_id, seed_course_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
            values: [fullname, shortname, categoryid || null, idnumber || null, summary || null, visible == null ? true : visible, format || 'topics', numsections || 10, moodle_id || null, seed_course_id || null]
        };
    }
    const data = jsonData.data || jsonData;
    return {
        text: `INSERT INTO ${table} (data) VALUES ($1) RETURNING *`,
        values: [JSON.stringify(data)]
    };
};

const updateData = (table, jsonData) => {
    if (table === 'users') {
        const {
            id, firstname, lastname, city, country, password, moodle_id,
            documento, correo_personal, telefono, celular, fecha_nacimiento,
            jornada, departamento_academico, plan_estudios
        } = jsonData;
        return {
            text: `UPDATE users SET
                firstname = $1, lastname = $2, city = $3, country = $4, password = $5, moodle_id = $6,
                documento = $7, correo_personal = $8, telefono = $9, celular = $10,
                fecha_nacimiento = $11, jornada = $12, departamento_academico = $13,
                plan_estudios = $14 WHERE id = $15 RETURNING *`,
            values: [
                firstname, lastname, city, country, password, moodle_id || null,
                documento || null, correo_personal || null, telefono || null,
                celular || null, fecha_nacimiento || null, jornada || null,
                departamento_academico || null, plan_estudios || null, id
            ]
        };
    } else if (table === 'courses') {
        const { id, fullname, categoryid, idnumber, summary, visible, format, numsections, moodle_id, seed_course_id } = jsonData;
        return {
            text: `UPDATE courses SET fullname = $1, categoryid = $2, idnumber = $3, summary = $4, visible = $5, format = $6, numsections = $7, moodle_id = $8, seed_course_id = $9 WHERE id = $10 RETURNING *`,
            values: [fullname, categoryid || null, idnumber || null, summary || null, visible == null ? true : visible, format || 'topics', numsections || 10, moodle_id || null, seed_course_id || null, id]
        };
    } else if (table === 'enrollments') {
        const { id, moodle_enrollment_id } = jsonData;
        return {
            text: `UPDATE enrollments SET moodle_enrollment_id = $1 WHERE id = $2 RETURNING *`,
            values: [moodle_enrollment_id || null, id]
        };
    }
    const { id, data } = jsonData;
    return {
        text: `UPDATE ${table} SET data = $1 WHERE id = $2 RETURNING *`,
        values: [JSON.stringify(data), id]
    };
};

// ─── QUERIES SICAU USUARIOS ───────────────────────────────────────────────────
const findUserByEmailOrUsername = (email, username) => ({
    text: 'SELECT id FROM users WHERE email = $1 OR username = $2 LIMIT 1',
    values: [email, username]
});

const updateUserSicau = (user) => ({
    text: `UPDATE users SET
        firstname = $1, lastname = $2, city = $3, country = $4,
        documento = $5, correo_personal = $6, telefono = $7, celular = $8,
        fecha_nacimiento = $9, jornada = $10, departamento_academico = $11,
        plan_estudios = $12 WHERE email = $13 OR username = $14`,
    values: [
        user.firstname, user.lastname, user.city || 'Medellín', user.country || 'CO',
        user.documento || null, user.correo_personal || null,
        user.telefono || null, user.celular || null,
        user.fecha_nacimiento || null, user.jornada || null,
        user.departamento_academico || null, user.plan_estudios || null,
        user.email, user.username
    ]
});

// ─── QUERIES SICAU MATRÍCULAS ─────────────────────────────────────────────────
const findUserByDocumento = (documento) => ({
    text: 'SELECT id FROM users WHERE documento = $1 LIMIT 1',
    values: [documento]
});

const findCourseByIdnumber = (idnumber) => ({
    text: 'SELECT id FROM courses WHERE idnumber = $1 LIMIT 1',
    values: [idnumber]
});

const findEnrollmentByCodigoJourney = (codigoJourney) => ({
    text: 'SELECT id FROM enrollments WHERE codigo_journey = $1 LIMIT 1',
    values: [codigoJourney]
});

const findAllEnrollmentsWithUsers = () => ({
    text: `SELECT 
        e.id, e.userid, e.courseid, e.role, e.moodle_enrollment_id,
        e.codigo_asignatura, e.nombre_asignatura, e.programa,
        e.periodo, e.grupo, e.codigo_journey, e.estado,
        e.fecha_creacion_journey, e.created_at,
        u.firstname, u.lastname, u.email, u.documento
    FROM enrollments e
    LEFT JOIN users u ON u.id = e.userid
    ORDER BY e.id DESC`,
    values: []
});

module.exports = {
    selectAllItems,
    insertData,
    updateData,
    findUserByEmailOrUsername,
    updateUserSicau,
    findUserByDocumento,
    findCourseByIdnumber,
    findEnrollmentByCodigoJourney,
    findAllEnrollmentsWithUsers
};