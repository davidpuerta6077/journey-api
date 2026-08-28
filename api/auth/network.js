const express = require('express');
const router = express.Router();
const response = require('../../network/response')
const { login } = require('./index')
const checkAuth = require('../../middleware/checkAuth');
const ctrl = require('./index');
const checkout = require('../../middleware/checkAuth');

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


module.exports = router
