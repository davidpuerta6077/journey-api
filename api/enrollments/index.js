const controller = require('./controller')

//const database = require('../../../database/dummy')
const database = require('../../database/remote-postgresql')

module.exports = controller;