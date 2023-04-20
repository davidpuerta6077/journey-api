const request = require("request");


function createRemoteDB(host, port) {
    const URL = 'http://'+host+':'+port

    function listAllRemote(table){
        return req('GET', table )
    }

    function req(method, table, data){
        let url = URL + '/' + table; 
        let body = ''
         
        return new Promise((resolve, reject) => {
            request({
                method,
                headers: {
                    'content-type': 'application/json',
                },
                url, 
                body,
            },(err, req, body) => {
                if (err){
                    console.log('Error con la base de datos remota', err)
                    return reject(err.message)
                }

                const response = JSON.parse(body)
                return resolve(response.body)
            })
        })
    }

    return {
        listAllRemote,
    }
}

module.exports = createRemoteDB
