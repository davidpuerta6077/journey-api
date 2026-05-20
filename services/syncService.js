const { moodleRequest } = require('./moodleService');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const mysql = require('mysql2/promise');
const config = require('../config');

const usersCtrl = require('../api/users/index');
const coursesCtrl = require('../api/courses/index');
const enrollmentsCtrl = require('../api/enrollments/index');

const moodleDB = mysql.createPool({
    host:     config.moodle_db.host,
    user:     config.moodle_db.user,
    password: config.moodle_db.password,
    database: config.moodle_db.database
});

const parseMoodleId = (result) => {
    if (!result) return null;
    if (Array.isArray(result) && result.length > 0) {
        return result[0]?.id || result[0]?.userid || null;
    }
    return result.id || result.userid || null;
};

const parseMoodleEnrollmentId = (result) => {
    if (!result) return null;
    if (Array.isArray(result) && result.length > 0) {
        return result[0]?.id || result[0]?.enrollmentid || null;
    }
    return result.id || result.enrollmentid || null;
};

// ─── HELPER MOODLE CLI ────────────────────────────────────────────────────────

async function runMoodleAuthSync() {
    const phpPath = config.moodle_cli.php_path;
    const moodlePath = config.moodle_cli.moodle_path;
    const { stdout, stderr } = await execPromise(
        `"${phpPath}" "${moodlePath}\\admin\\cli\\scheduled_task.php" --execute="\\auth_db\\task\\sync_users"`
    );
    console.log('Moodle auth sync output:', stdout);
    if (stderr) console.warn('Moodle auth sync stderr:', stderr);
    return stdout;
}

// ─── HELPER CONSULTA MYSQL MOODLE ────────────────────────────────────────────

async function getMoodleUserByUsername(username) {
    const [rows] = await moodleDB.query(
        'SELECT id, username FROM mdl_user WHERE username = ? AND deleted = 0 LIMIT 1',
        [username]
    );
    return rows.length > 0 ? rows[0] : null;
}

// ─── PREVIEW FUNCTIONS ───────────────────────────────────────────────────────

async function previewStudents() {
    const users = await usersCtrl.listUsersForSync();

    const results = [];
    for (const user of users) {
        const status = { inDB: true, inMoodle: false };

        const moodleUser = await getMoodleUserByUsername(user.username);
        status.inMoodle = !!moodleUser;

        if (moodleUser && !user.moodle_id) {
            await usersCtrl.updateMoodleId(user.id, moodleUser.id);
        }

        if (!moodleUser && user.moodle_id) {
            await usersCtrl.clearMoodleId(user.id);
        }

        results.push({ ...user, _syncStatus: status });
    }
    return results;
}

async function previewCourses() {
    const courses = await coursesCtrl.listCoursesForSync();
    return courses.map(course => ({
        ...course,
        _syncStatus: { inDB: true, inMoodle: !!course.moodle_id }
    }));
}

async function previewEnrollments() {
    const enrollments = await enrollmentsCtrl.listEnrollmentsForSync();
    return enrollments.map(enr => ({
        ...enr,
        studentId: enr.userid,
        courseId: enr.courseid,
        _syncStatus: { inDB: true, inMoodle: !!enr.moodle_enrollment_id }
    }));
}

// ─── SYNC FUNCTIONS ──────────────────────────────────────────────────────────

async function syncStudents(items = []) {
    const results = [];

    for (const user of items) {
        const result = { id: user.id, username: user.username, email: user.email };

        try {
            if (!user.email && !user.username) {
                result.status = 'error';
                result.error = 'Sin email ni username';
                results.push(result);
                continue;
            }

            const moodleUsername = user.username || user.email;

            const allUsers = await usersCtrl.listUsersForSync();
            const existing = allUsers.filter(u => u.email === user.email || u.username === moodleUsername);

            let localUser = null;

            if (existing.length > 0) {
                localUser = existing[0];
                await usersCtrl.updateElement({
                    id:                    localUser.id,
                    firstname:             user.firstname,
                    lastname:              user.lastname,
                    city:                  user.city                    || 'Medellín',
                    country:               user.country                 || 'CO',
                    password:              localUser.password,
                    moodle_id:             localUser.moodle_id,
                    documento:             user.documento               || null,
                    correo_personal:       user.correo_personal         || null,
                    telefono:              user.telefono                || null,
                    celular:               user.celular                 || null,
                    fecha_nacimiento:      user.fecha_nacimiento        || null,
                    jornada:               user.jornada                 || null,
                    departamento_academico: user.departamento_academico || null,
                    plan_estudios:         user.plan_estudios           || null
                });
                result.status = 'exists';
            } else {
                const inserted = await usersCtrl.addElement({
                    username:              moodleUsername,
                    firstname:             user.firstname,
                    lastname:              user.lastname,
                    email:                 user.email,
                    password:              user.documento ? String(user.documento) : 'Pascual2024*',
                    city:                  user.city                    || 'Medellín',
                    country:               user.country                 || 'CO',
                    documento:             user.documento               || null,
                    correo_personal:       user.correo_personal         || null,
                    telefono:              user.telefono                || null,
                    celular:               user.celular                 || null,
                    fecha_nacimiento:      user.fecha_nacimiento        || null,
                    jornada:               user.jornada                 || null,
                    departamento_academico: user.departamento_academico || null,
                    plan_estudios:         user.plan_estudios           || null,
                    moodle_id:             null
                });
                localUser = inserted[0];
                result.status = 'success';
            }

            // ─── Sync via BD externa ──────────────────────────────────────────
            await runMoodleAuthSync();

            // ─── Verificar en MySQL de Moodle local ──────────────────────────
            const moodleUser = await getMoodleUserByUsername(moodleUsername);

            if (moodleUser) {
                await usersCtrl.updateMoodleId(localUser.id, moodleUser.id);
                result.moodle_id = moodleUser.id;
            } else {
                result.moodle_warning = 'Sync ejecutado pero usuario no encontrado en Moodle';
            }

        } catch (error) {
            console.error('Error sincronizando usuario:', user.username, error.message);
            result.status = 'error';
            result.error = error.message;
        }

        results.push(result);
    }

    return { results };
}

async function syncCourses(items = []) {
    const results = [];

    for (const course of items) {
        const result = { id: course.id, shortname: course.shortname };

        try {
            if (!course.shortname) {
                result.status = 'error';
                result.error = 'Sin shortname';
                results.push(result);
                continue;
            }

            const saved = await coursesCtrl.saveSicauCurso(course);
            result.status = saved.status;

            const courses = await coursesCtrl.listCoursesForSync();
            const localCourse = courses.find(c => c.shortname === course.shortname);

            if (localCourse && !localCourse.moodle_id) {
                const moodleResult = await moodleRequest('core_course_create_courses', {
                    'courses[0][fullname]':    course.fullname,
                    'courses[0][shortname]':   course.shortname,
                    'courses[0][categoryid]':  course.categoryid  || 1,
                    'courses[0][idnumber]':    course.idnumber    || course.shortname,
                    'courses[0][summary]':     course.summary     || '',
                    'courses[0][format]':      course.format      || 'topics',
                    'courses[0][numsections]': course.numsections || 10
                });

                const moodleId = parseMoodleId(moodleResult);
                if (moodleId) {
                    await coursesCtrl.updateCourseMoodleId(localCourse.id, moodleId);
                    result.moodle_id = moodleId;
                } else {
                    result.moodle_warning = 'Curso guardado en BD pero no en Moodle';
                }
            }

        } catch (error) {
            console.error('Error sincronizando curso:', course.shortname, error.message);
            result.status = 'error';
            result.error = error.message;
        }

        results.push(result);
    }

    return { results };
}

async function syncEnrollments(items = []) {
    const results = [];

    for (const enr of items) {
        const userid = enr.studentId || enr.teacherId || enr.userid;
        const courseid = enr.courseId || enr.courseid;
        const result = { id: enr.id, userid, courseid };

        try {
            if (!userid || !courseid) {
                result.status = 'error';
                result.error = 'Sin userid o courseId';
                results.push(result);
                continue;
            }

            const allEnrollments = await enrollmentsCtrl.listEnrollmentsForSync();
            const existing = allEnrollments.find(e => e.userid === userid && e.courseid === courseid);

            let localEnrollment = null;

            if (existing) {
                localEnrollment = existing;
                result.status = 'exists';
            } else {
                const inserted = await enrollmentsCtrl.addElement({
                    userid,
                    courseid,
                    role:                 enr.role || 'student',
                    moodle_enrollment_id: null
                });
                localEnrollment = inserted[0];
                result.status = 'success';
            }

            if (!localEnrollment.moodle_enrollment_id) {
                const moodleResult = await moodleRequest('enrol_manual_enrol_users', {
                    'enrolments[0][userid]':   userid,
                    'enrolments[0][courseid]': courseid,
                    'enrolments[0][roleid]':   enr.role === 'teacher' ? 3 : 5
                });

                const moodleEnrollmentId = parseMoodleEnrollmentId(moodleResult);
                if (moodleEnrollmentId) {
                    await enrollmentsCtrl.updateEnrollmentMoodleId(localEnrollment.id, moodleEnrollmentId);
                    result.moodle_enrollment_id = moodleEnrollmentId;
                } else {
                    result.moodle_warning = 'Matrícula guardada en BD pero no en Moodle';
                }
            }

        } catch (error) {
            console.error('Error sincronizando matrícula:', userid, courseid, error.message);
            result.status = 'error';
            result.error = error.message;
        }

        results.push(result);
    }

    return { results };
}

module.exports = {
    previewStudents,
    previewCourses,
    previewEnrollments,
    syncStudents,
    syncCourses,
    syncEnrollments
};