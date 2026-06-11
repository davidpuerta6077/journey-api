const bcrypt = require('bcrypt');
const jwt    = require('jsonwebtoken');
const config = require('../../config');

async function login(email, password) {
    const adminEmail = process.env.ADMIN_EMAIL;
    const adminHash  = process.env.ADMIN_PASSWORD_HASH;

    if (!adminEmail || !adminHash) {
        throw new Error('Credenciales de administrador no configuradas en el servidor.');
    }
    if (email !== adminEmail) {
        throw new Error('Credenciales inválidas.');
    }

    const valid = await bcrypt.compare(password, adminHash);
    if (!valid) throw new Error('Credenciales inválidas.');

    const token = jwt.sign(
        { email, rol: 'admin' },
        config.jwt.secret,
        { expiresIn: '8h' }
    );

    return {
        token,
        user: { email, rol: 'admin' }
    };
}

module.exports = { login };
