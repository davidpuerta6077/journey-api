const express = require('express');
const app = express();
const items = require('./users/network')
const config = require('../config')
const bodyParser = require('body-parser')
//routes

app.use(bodyParser.json())

app.use('/users', items);

app.listen(config.api.port, () =>{
    console.log("Server Run on port: "+ config.api.port );
});





