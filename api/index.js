const express = require('express');
const app = express();
const items = require('./users/network')
const item = require('./courses/network')
const item1 = require('./enrollments/network')
const item2 = require('./grades/network')
const config = require('../config')
const bodyParser = require('body-parser')
//routes

app.use(bodyParser.json())

app.use('/users', items);
app.use('/courses', item);
app.use('/enrollments', item1);
app.use('/grades', item2);

app.listen(config.api.port, () =>{
    console.log("Server Run on port: "+ config.api.port );
});





