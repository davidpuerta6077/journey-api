const ctrl = require('./controller')

//const database = require('../../../database/dummy')
const database = require('../../database/remote-postgresql')

module.exports = ctrl(database)