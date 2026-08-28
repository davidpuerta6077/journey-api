const jwt = require('jsonwebtoken')
const config = require('../config')
const secret = config.jwt.secret
const err = require('../utils/error')

const sign = (data) =>{
    return jwt.sign(data, secret, { expiresIn: '6h' })
}; 

const verify = (token) => {
    return jwt.verify(token, secret)
};

const check = {
    own: (req, owner) => {
        const decoded = decodeHeader(req);
        if (decoded.id !== owner) {
            throw err('No eres el owner', 401);
        }
    },
    admin: (req, token) => {
        const decoded = decodeHeader(req);
        if (decoded.role !== 'admin') {
            throw err('No eres el admin', 401);
        }
    }
};

const getToken = (authorization) => {
    if (!authorization){
        throw err("No viene un token", 500);
    };

    if (authorization.indexOf('Bearer ') === -1 ){
        throw err("Formato invalido", 401)
    };

    let token = authorization.replace("Bearer ", '');
    return token
};

const decodeHeader = (req) => {
    const authorization = req.headers.authorization || '';
    const token = getToken(authorization);
    const decoded = verify(token);

    req.user = decoded;

    return decoded
};

module.exports = {
    sign,
    check,
};