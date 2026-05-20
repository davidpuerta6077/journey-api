const ctrl = require('./controller');
const database = require('../../database/postgresql');
module.exports = ctrl(database);