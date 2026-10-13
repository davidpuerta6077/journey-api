const database = require('../../database/postgresql');
const ctrl = require('./controller');

module.exports = ctrl(database);
