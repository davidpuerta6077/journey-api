//const store = require('../../../store/mysql')
const database = require('../../database/postgresql')
const ctrl = require('./controller')


module.exports = ctrl(database)