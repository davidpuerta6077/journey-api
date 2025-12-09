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
const ROOT = path.resolve(__dirname, '..'); 
const app = express();
const cors = require('cors');

app.use(cors());
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



app.use(express.static(path.join(ROOT, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(ROOT, '../public/index.html'));
});

app.use('/uploads', express.static(path.join(ROOT, 'uploads')));

app.get('/carga-usuarios', (req, res) => {
  res.sendFile(path.resolve(ROOT, '../public', 'Carga_Usuarios.html'));
});

const PORT = config.api.port || 3000;
app.listen(PORT, () => {
  console.log(` Servidor corriendo en http://localhost:${PORT}`);
});

app.use((req, res, next) => {
 
    res.header("Access-Control-Allow-Origin", "*");
  
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
    
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    
    next();
});

app.use(express.json());

console.log('--- INTENTANDO CONECTAR ---');
console.log('Host:', config.postgresql.host);
console.log('Port:', config.postgresql.port);
console.log('User:', config.postgresql.user);
// No imprimas la contraseña
console.log('---------------------------');