    const remote = require ('../postgresql/remote')
    const config = require('../config')

    module.exports = new remote(config.postgresqlService.host, config.postgresqlService.port)