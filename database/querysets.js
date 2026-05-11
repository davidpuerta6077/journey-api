
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
        const { userid, courseid, role, moodle_enrollment_id } = jsonData;
        return {
            text: `INSERT INTO enrollments (userid, courseid, role, moodle_enrollment_id) VALUES ($1, $2, $3, $4) RETURNING *`,
            values: [userid, courseid, role || 'student', moodle_enrollment_id || null]
        };
    } else if (table === 'courses') {
        const { fullname, shortname, categoryid, idnumber, summary, visible, format, numsections, moodle_id, seed_course_id } = jsonData;
        return {
            text: `INSERT INTO courses (fullname, shortname, categoryid, idnumber, summary, visible, format, numsections, moodle_id, seed_course_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
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
                plan_estudios = $14
            WHERE id = $15 RETURNING *`,
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


module.exports = {
    selectAllItems,
    insertData,
    updateData
};