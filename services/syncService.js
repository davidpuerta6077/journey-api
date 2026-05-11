const { insertItem, query } = require('../database/postgresql');
const { moodleRequest } = require('./moodleService');

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

// ─── PREVIEW FUNCTIONS ───────────────────────────────────────────────────────

async function previewStudents() {
  const users = await query({
    text: `SELECT id, username, firstname, lastname, email, city, country,
           documento, correo_personal, telefono, celular, fecha_nacimiento,
           jornada, departamento_academico, plan_estudios, moodle_id
           FROM users ORDER BY id DESC`,
    values: []
  });

  const results = [];
  for (const user of users) {
    const status = { inDB: true, inMoodle: false };

    if (user.moodle_id) {
      const check = await moodleRequest('core_user_get_users_by_field', {
        'field': 'username',
        'values[0]': user.username
      });
      status.inMoodle = Array.isArray(check) && check.length > 0;

      if (!status.inMoodle) {
        await query({
          text: 'UPDATE users SET moodle_id = NULL WHERE id = $1',
          values: [user.id]
        });
      }
    }

    results.push({ ...user, _syncStatus: status });
  }
  return results;
}

async function previewCourses() {
  const courses = await query({
    text: `SELECT id, fullname, shortname, categoryid, idnumber, summary, visible, format, numsections, moodle_id FROM courses ORDER BY id DESC`,
    values: []
  });

  return courses.map(course => ({
    ...course,
    _syncStatus: { inDB: true, inMoodle: !!course.moodle_id }
  }));
}

async function previewEnrollments() {
  const enrollments = await query({
    text: `SELECT id, userid, courseid, role, moodle_enrollment_id FROM enrollments ORDER BY id DESC`,
    values: []
  });

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

      // username en Moodle = correo institucional completo
      const moodleUsername = user.username || user.email;
      // password en Moodle = documento
      const moodlePassword = user.documento ? String(user.documento) : 'Pascual2024*';

      const existing = await query({
        text: 'SELECT * FROM users WHERE email = $1 OR username = $2 LIMIT 1',
        values: [user.email, moodleUsername]
      });

      let localUser = null;

      if (existing.length > 0) {
        localUser = existing[0];
        await query({
          text: `UPDATE users SET firstname = $1, lastname = $2, city = $3, country = $4,
                 documento = $5, correo_personal = $6, telefono = $7, celular = $8,
                 fecha_nacimiento = $9, jornada = $10, departamento_academico = $11,
                 plan_estudios = $12 WHERE id = $13`,
          values: [
            user.firstname, user.lastname, user.city || 'Medellín', user.country || 'CO',
            user.documento || null, user.correo_personal || null,
            user.telefono || null, user.celular || null,
            user.fecha_nacimiento || null, user.jornada || null,
            user.departamento_academico || null, user.plan_estudios || null,
            localUser.id
          ]
        });
        result.status = 'exists';
      } else {
        const inserted = await insertItem('users', {
          username: moodleUsername,
          firstname: user.firstname,
          lastname: user.lastname,
          email: user.email,
          password: moodlePassword,
          city: user.city || 'Medellín',
          country: user.country || 'CO',
          documento: user.documento || null,
          correo_personal: user.correo_personal || null,
          telefono: user.telefono || null,
          celular: user.celular || null,
          fecha_nacimiento: user.fecha_nacimiento || null,
          jornada: user.jornada || null,
          departamento_academico: user.departamento_academico || null,
          plan_estudios: user.plan_estudios || null,
          moodle_id: null
        });
        localUser = inserted[0];
        result.status = 'success';
      }

      if (!localUser.moodle_id) {
        const moodleResult = await moodleRequest('core_user_create_users', {
          'users[0][username]': moodleUsername,
          'users[0][firstname]': user.firstname,
          'users[0][lastname]': user.lastname,
          'users[0][email]': user.email,
          'users[0][password]': moodlePassword,
          'users[0][city]': user.city || 'Medellín',
          'users[0][country]': user.country || 'CO'
        });

        const moodleId = parseMoodleId(moodleResult);
        if (moodleId) {
          await query({
            text: 'UPDATE users SET moodle_id = $1 WHERE id = $2',
            values: [moodleId, localUser.id]
          });
          result.moodle_id = moodleId;
        } else {
          result.moodle_warning = 'Usuario guardado en BD pero no en Moodle';
        }
      } else {
        const check = await moodleRequest('core_user_get_users_by_field', {
          'field': 'username',
          'values[0]': moodleUsername
        });

        const exists = Array.isArray(check) && check.length > 0;
        if (!exists) {
          await query({
            text: 'UPDATE users SET moodle_id = NULL WHERE id = $1',
            values: [localUser.id]
          });

          const moodleResult = await moodleRequest('core_user_create_users', {
            'users[0][username]': moodleUsername,
            'users[0][firstname]': user.firstname,
            'users[0][lastname]': user.lastname,
            'users[0][email]': user.email,
            'users[0][password]': moodlePassword,
            'users[0][city]': user.city || 'Medellín',
            'users[0][country]': user.country || 'CO'
          });

          const moodleId = parseMoodleId(moodleResult);
          if (moodleId) {
            await query({
              text: 'UPDATE users SET moodle_id = $1 WHERE id = $2',
              values: [moodleId, localUser.id]
            });
            result.moodle_id = moodleId;
            result.status = 'success';
          }
        }
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

      const existing = await query({
        text: 'SELECT * FROM courses WHERE shortname = $1 LIMIT 1',
        values: [course.shortname]
      });

      let localCourse = null;

      if (existing.length > 0) {
        localCourse = existing[0];
        await query({
          text: `UPDATE courses SET fullname = $1, categoryid = $2 WHERE id = $3`,
          values: [course.fullname, course.categoryid || null, localCourse.id]
        });
        result.status = 'exists';
      } else {
        const inserted = await insertItem('courses', {
          fullname: course.fullname,
          shortname: course.shortname,
          categoryid: course.categoryid || null,
          idnumber: course.idnumber || null,
          summary: course.summary || null,
          visible: course.visible == null ? true : course.visible,
          format: course.format || 'topics',
          numsections: course.numsections || 10,
          moodle_id: null,
          seed_course_id: course.seed_course_id || null
        });
        localCourse = inserted[0];
        result.status = 'success';
      }

      if (!localCourse.moodle_id) {
        const moodleResult = await moodleRequest('core_course_create_courses', {
          'courses[0][fullname]': course.fullname,
          'courses[0][shortname]': course.shortname,
          'courses[0][categoryid]': course.categoryid || 1,
          'courses[0][idnumber]': course.idnumber || course.shortname,
          'courses[0][summary]': course.summary || '',
          'courses[0][format]': course.format || 'topics',
          'courses[0][numsections]': course.numsections || 10
        });

        const moodleId = parseMoodleId(moodleResult);
        if (moodleId) {
          await query({
            text: 'UPDATE courses SET moodle_id = $1 WHERE id = $2',
            values: [moodleId, localCourse.id]
          });
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

      const existing = await query({
        text: 'SELECT * FROM enrollments WHERE userid = $1 AND courseid = $2 LIMIT 1',
        values: [userid, courseid]
      });

      let localEnrollment = null;

      if (existing.length > 0) {
        localEnrollment = existing[0];
        result.status = 'exists';
      } else {
        const inserted = await insertItem('enrollments', {
          userid,
          courseid,
          role: enr.role || 'student',
          moodle_enrollment_id: null
        });
        localEnrollment = inserted[0];
        result.status = 'success';
      }

      if (!localEnrollment.moodle_enrollment_id) {
        const moodleResult = await moodleRequest('enrol_manual_enrol_users', {
          'enrolments[0][userid]': userid,
          'enrolments[0][courseid]': courseid,
          'enrolments[0][roleid]': enr.role === 'teacher' ? 3 : 5
        });

        const moodleEnrollmentId = parseMoodleEnrollmentId(moodleResult);
        if (moodleEnrollmentId) {
          await query({
            text: 'UPDATE enrollments SET moodle_enrollment_id = $1 WHERE id = $2',
            values: [moodleEnrollmentId, localEnrollment.id]
          });
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