const { Router } = require('express');
const router   = Router();
const response = require('../../network/response');
const { login } = require('./index');

router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return response.error(req, res, 'Email y contraseña son requeridos.', 400);
    }
    try {
        const result = await login(email, password);
        response.success(req, res, result, 200);
    } catch (error) {
        response.error(req, res, error.message, 401);
    }
});

module.exports = router;
