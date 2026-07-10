const { Router } = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const router = Router();
const response = require('../../network/response');
const config = require('../../config');

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Autenticar usuario administrador
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:    { type: string, example: "admin@journey.com" }
 *               password: { type: string, example: "1234" }
 *     responses:
 *       200:
 *         description: Login exitoso
 *       401:
 *         description: Credenciales inválidas
 */
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return response.error(req, res, 'Email y contraseña son requeridos.', 400);
    }
    if (email !== config.admin.email) {
        return response.error(req, res, 'Credenciales inválidas.', 401);
    }
    const match = await bcrypt.compare(password, config.admin.passwordHash);
    if (!match) {
        return response.error(req, res, 'Credenciales inválidas.', 401);
    }
    const user = { email, role: 'admin' };
    const token = jwt.sign(user, config.jwt.secret, { expiresIn: '8h' });
    response.success(req, res, { token, user }, 200);
});

module.exports = router;
