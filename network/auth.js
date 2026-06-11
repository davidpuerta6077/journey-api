const jwt    = require('jsonwebtoken');
const config = require('../config');
const response = require('./response');

function verifyToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
        return response.error(req, res, 'Token de autenticación requerido.', 401);
    }

    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;

    try {
        req.user = jwt.verify(token, config.jwt.secret);
        next();
    } catch {
        return response.error(req, res, 'Token inválido o expirado.', 401);
    }
}

module.exports = { verifyToken };
