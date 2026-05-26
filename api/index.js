const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const config = require('../config');
const fileUpload = require('express-fileupload');
const cors = require('cors');
const users = require('./users/network');
const courses = require('./courses/network');
const enrollments = require('./enrollments/network');
const response = require('../network/response');
const grades = require('./grades/network');
const ROOT = path.resolve(__dirname, '..');

const app = express();

app.use(cors());
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true }));
app.use(fileUpload({
    limits: { fileSize: 50 * 1024 * 1024 },
    useTempFiles: true,
    tempFileDir: '/tmp/'
}));
//app.use(express.static(path.join(ROOT, 'public')));
app.use('/uploads', express.static(path.join(ROOT, 'uploads')));

// ─── MÓDULOS ──────────────────────────────────────────────────────────────────
app.use('/users', users);
app.use('/courses', courses);
app.use('/enrollments', enrollments);
app.use('/grades', grades);


// ─── PÁGINAS ──────────────────────────────────────────────────────────────────
// app.get('/', (req, res) => {
//     res.sendFile(path.join(ROOT, 'public', 'index.html'));
// });

// app.get('/carga-usuarios', (req, res) => {
//     res.sendFile(path.join(ROOT, 'public', 'Carga_Usuarios.html'));
// });

// ─── MIDDLEWARE DE ERRORES ────────────────────────────────────────────────────
app.use((err, req, res, next) => {
    console.error(err);
    response.error(req, res, err.message || 'Internal server error', err.status || 500);
});

// ─── SERVIDOR ─────────────────────────────────────────────────────────────────
const PORT = config.api.port;
app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});