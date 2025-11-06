const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const config = require('../config');
const fs = require('fs');
const fileUpload = require('express-fileupload');
const users = require('./users/network');
const courses = require('./courses/network');
const enrollments = require('./enrollments/network');
const grades = require('./grades/network');

const app = express();

app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true }));
app.use(fileUpload({
    limits: { fileSize: 50 * 1024 * 1024 }, // Límite de 50MB
    useTempFiles: true,
    tempFileDir: '/tmp/' // Asegúrate de que este directorio exista o sea accesible
}));

app.use('/users', users);
app.use('/courses', courses);
app.use('/enrollments', enrollments);
app.use('/grades', grades);



app.use(express.static(path.join(__dirname, '../public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});


app.get('/carga-usuarios', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/Carga_Usuarios.html'));
});

const PORT = config.api.port || 3000;
app.listen(PORT, () => {
  console.log(` Servidor corriendo en http://localhost:${PORT}`);
});

