const express = require('express');
const app = express();
const items = require('./users/network')
const items = require('./courses/network')
const items = require('./enrollments/network')
const items = require('./grades/network')
const config = require('../config')
const bodyParser = require('body-parser')
//routes

app.use(bodyParser.json())

app.use('/users', items);
app.use('/courses', items);
app.use('/enrollments', items);
app.use('/grades', items);

app.listen(config.api.port, () =>{
    console.log("Server Run on port: "+ config.api.port );
});





