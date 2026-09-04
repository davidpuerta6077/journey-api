const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const response = require('../../network/response')
const { login } = require('./index')
const checkAuth = require('../../middleware/checkAuth');
const ctrl = require('./index');

router.post('/login', (req, res) => {
    login(req.body.user_email)
        .then(token => {
            response.success(req, res, token, 200)
        })
        .catch(e => {
            response.error(req, res, `Denegado ${e}`, 405)
        });
});

router.get('/permissions', checkAuth, async (req, res) => {
    console.log("Query parameters:", req.query);
    const userEmail = req.query.user_email;
    const responseData = await ctrl.permissions(userEmail);
    try {
        response.success(req, res, responseData[0], 200)

    } catch (error) {
        response.error(req, res, error.message, 500);
    }
});

/**
 * @swagger
 * /auth/me:
 *   get:
 *     summary: Obtener el perfil (usuario de plataforma) del usuario autenticado
 *     tags: [Auth]
 *     responses:
 *       200: { description: Perfil del usuario autenticado }
 *       404: { description: No existe un usuario de plataforma con ese email }
 */
router.get('/me', checkAuth, async (req, res, next) => {
    try {
        const profile = await ctrl.me(req.user.email);
        if (!profile) return response.error(req, res, 'No existe un usuario de plataforma con este email', 404);
        response.success(req, res, profile, 200);
    } catch (error) {
        next(error);
    }
});

/**
 * @swagger
 * /auth/me:
 *   put:
 *     summary: Actualizar el username del usuario autenticado
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [username]
 *             properties:
 *               username: { type: string }
 *     responses:
 *       200: { description: Perfil actualizado }
 *       400: { description: Username vacío }
 *       409: { description: Username ya en uso }
 */
router.put('/me', checkAuth, async (req, res, next) => {
    const username = (req.body.username || '').trim();
    if (!username) return response.error(req, res, 'El username no puede estar vacío', 400);
    try {
        const updated = await ctrl.updateMyUsername(req.user.email, username);
        response.success(req, res, updated, 200);
    } catch (error) {
        response.error(req, res, error.message, error.status || 500);
    }
});

/**
 * @swagger
 * /auth/me/foto:
 *   post:
 *     summary: Subir/actualizar la foto de perfil del usuario autenticado
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               foto: { type: string, format: binary }
 *     responses:
 *       200: { description: Foto actualizada }
 *       400: { description: No se recibió ningún archivo }
 */
router.post('/me/foto', checkAuth, (req, res, next) => {
    if (!req.files || !req.files.foto) {
        return response.error(req, res, 'No se recibió ningún archivo.', 400);
    }
    const file = req.files.foto;
    const uploadDir = path.join(__dirname, '../../uploads/avatars');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    const ext = path.extname(file.name) || '.jpg';
    const fileName = `avatar_${Date.now()}${ext}`;
    const filePath = path.join(uploadDir, fileName);
    file.mv(filePath, async (err) => {
        if (err) return response.error(req, res, err.message, 500);
        try {
            const photoUrl = `/uploads/avatars/${fileName}`;
            const updated = await ctrl.updateMyPhoto(req.user.email, photoUrl);
            response.success(req, res, updated, 200);
        } catch (error) {
            next(error);
        }
    });
});


module.exports = router
