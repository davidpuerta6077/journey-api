const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const config = require('../config');
const fileUpload = require('express-fileupload');
const cors = require('cors');
const users = require('./users/network');
const courses = require('./courses/network');
const enrollments = require('./enrollments/network');
const grades = require('./grades/network');
const response = require('../network/response');
const syncService = require('../services/syncService');
const { query } = require('../database/postgresql');
const ROOT = path.resolve(__dirname, '..');
const health = require('./health/network');


const app = express();

app.use(cors());
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
app.use('/health', health);

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
        await query({ text: 'DELETE FROM users WHERE id = $1', values: [req.params.id] });
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