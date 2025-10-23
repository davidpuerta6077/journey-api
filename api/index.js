const express = require('express');
const app = express();
const users = require('./users/network')
const courses = require('./courses/network')
const enrollments = require('./enrollments/network')
const grades = require('./grades/network')
const config = require('../config')
const bodyParser = require('body-parser')
//routes

app.use(bodyParser.json())

app.use('/users', users);
app.use('/courses', courses);
app.use('/enrollments', enrollments);
app.use('/grades', grades);

app.listen(config.api.port, () =>{
    console.log("Server Run on port: "+ config.api.port );
});





