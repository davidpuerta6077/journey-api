const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const config = require('../config');
const fileUpload = require('express-fileupload');
const users = require('./users/network');
const courses = require('./courses/network');
const enrollments = require('./enrollments/network');
const grades = require('./grades/network');
const response = require('../network/response');
const syncService = require('../services/syncService');
const { query, insertItem } = require('../database/postgresql');
const ROOT = path.resolve(__dirname, '..');

const app = express();

// ─── MIDDLEWARE ───────────────────────────────────────────────────────────────
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true }));
app.use(fileUpload({
  limits: { fileSize: 50 * 1024 * 1024 },
  useTempFiles: true,
  tempFileDir: '/tmp/'
}));
app.use(express.static(path.join(ROOT, 'public')));
app.use('/uploads', express.static(path.join(ROOT, 'uploads')));

// ─── MÓDULOS ──────────────────────────────────────────────────────────────────
app.use('/users', users);
app.use('/courses', courses);
app.use('/enrollments', enrollments);
app.use('/grades', grades);

// ─── HELPER SYNC ─────────────────────────────────────────────────────────────
const handleSync = (syncFunction, isSync = false) => async (req, res, next) => {
  try {
    const result = isSync
      ? await syncFunction(req.body.items || [])
      : await syncFunction();
    response.success(req, res, result || 'Datos cargados correctamente', 200);
  } catch (error) {
    next(error);
  }
};

// ─── PREVIEW ENDPOINTS ────────────────────────────────────────────────────────
app.get('/sync/preview/students', handleSync(syncService.previewStudents, false));
app.get('/sync/preview/courses', handleSync(syncService.previewCourses, false));
app.get('/sync/preview/enrollments', handleSync(syncService.previewEnrollments, false));

// ─── SYNC ENDPOINTS ───────────────────────────────────────────────────────────
app.post('/sync/students', handleSync(syncService.syncStudents, true));
app.post('/sync/courses', handleSync(syncService.syncCourses, true));
app.post('/sync/enrollments', handleSync(syncService.syncEnrollments, true));

// ─── CRUD USUARIOS JOURNEY ────────────────────────────────────────────────────
app.delete('/journey/usuarios/:id', async (req, res, next) => {
  try {
    await query({
      text: 'DELETE FROM users WHERE id = $1',
      values: [req.params.id]
    });
    response.success(req, res, 'Usuario eliminado', 200);
  } catch (error) {
    next(error);
  }
});

app.put('/journey/usuarios/:id', async (req, res, next) => {
  try {
    const {
      firstname, lastname, email, city, country,
      documento, correo_personal, telefono, celular,
      fecha_nacimiento, jornada, departamento_academico, plan_estudios
    } = req.body;
    await query({
      text: `UPDATE users SET
        firstname = $1, lastname = $2, email = $3, city = $4, country = $5,
        documento = $6, correo_personal = $7, telefono = $8, celular = $9,
        fecha_nacimiento = $10, jornada = $11, departamento_academico = $12,
        plan_estudios = $13 WHERE id = $14`,
      values: [
        firstname, lastname, email, city || 'Medellín', country || 'CO',
        documento || null, correo_personal || null, telefono || null,
        celular || null, fecha_nacimiento || null, jornada || null,
        departamento_academico || null, plan_estudios || null,
        req.params.id
      ]
    });
    response.success(req, res, 'Usuario actualizado', 200);
  } catch (error) {
    next(error);
  }
});

// ─── ENDPOINTS RECEPCIÓN SICAU ────────────────────────────────────────────────
app.post('/api/sicau/usuarios', async (req, res, next) => {
  try {
    const items = req.body.users || req.body.items || req.body || [];
    const lista = Array.isArray(items) ? items : [items];
    const results = [];

    for (const user of lista) {
      const existing = await query({
        text: 'SELECT id FROM users WHERE email = $1 OR username = $2 LIMIT 1',
        values: [user.email, user.username]
      });

      if (existing.length > 0) {
        // Actualizar datos existentes con nuevos campos
        await query({
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
        results.push({ username: user.username, status: 'updated' });
      } else {
        await insertItem('users', {
          username: user.username,
          firstname: user.firstname,
          lastname: user.lastname,
          email: user.email,
          password: user.documento ? String(user.documento) : 'Pascual2024*',
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
        results.push({ username: user.username, status: 'saved' });
      }
    }
    response.success(req, res, { results }, 200);
  } catch (error) {
    next(error);
  }
});

app.post('/api/sicau/cursos', async (req, res, next) => {
  try {
    const items = req.body.courses || req.body.items || req.body || [];
    const lista = Array.isArray(items) ? items : [items];
    const results = [];

    for (const course of lista) {
      const existing = await query({
        text: 'SELECT id FROM courses WHERE shortname = $1 LIMIT 1',
        values: [course.shortname]
      });

      if (existing.length > 0) {
        results.push({ shortname: course.shortname, status: 'exists' });
      } else {
        await insertItem('courses', {
          fullname: course.fullname,
          shortname: course.shortname,
          categoryid: course.categoryid || null,
          idnumber: course.idnumber || null,
          summary: course.summary || null,
          visible: true,
          format: 'topics',
          numsections: 10,
          moodle_id: null,
          seed_course_id: null
        });
        results.push({ shortname: course.shortname, status: 'saved' });
      }
    }
    response.success(req, res, { results }, 200);
  } catch (error) {
    next(error);
  }
});

app.post('/api/sicau/matriculas', async (req, res, next) => {
  try {
    const items = req.body.enrollments || req.body.items || req.body || [];
    const lista = Array.isArray(items) ? items : [items];
    const results = [];

    for (const enr of lista) {
      const userid = enr.studentId || enr.teacherId || enr.userid;
      const existing = await query({
        text: 'SELECT id FROM enrollments WHERE userid = $1 AND courseid = $2 LIMIT 1',
        values: [userid, enr.courseId || enr.courseid]
      });

      if (existing.length > 0) {
        results.push({ userid, status: 'exists' });
      } else {
        await insertItem('enrollments', {
          userid,
          courseid: enr.courseId || enr.courseid,
          role: enr.role || 'student',
          moodle_enrollment_id: null
        });
        results.push({ userid, status: 'saved' });
      }
    }
    response.success(req, res, { results }, 200);
  } catch (error) {
    next(error);
  }
});

// ─── PÁGINAS ──────────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.sendFile(path.join(ROOT, 'public', 'index.html'));
});

app.get('/carga-usuarios', (req, res) => {
  res.sendFile(path.join(ROOT, 'public', 'Carga_Usuarios.html'));
});

// ─── MIDDLEWARE DE ERRORES ────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err);
  response.error(req, res, err.message || 'Internal server error', err.status || 500);
});

// ─── SERVIDOR ─────────────────────────────────────────────────────────────────
const PORT = config.api.port || 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});