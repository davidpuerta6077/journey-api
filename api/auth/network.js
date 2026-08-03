const express = require('express');
const router = express.Router();
const response = require('../../network/response')
const { login } = require('./index')
const checkAuth = require('../../middleware/checkAuth');

router.post('/login', (req, res) => {
    console.log(req.body)
    login(req.body.user_email)
        .then(token => {
            response.success(req, res, token, 200)
        })
        .catch(e => {
            response.error(req, res, `Denegado ${e}`, 405)
        });
});

router.get('/permissions', checkAuth, (req, res) => {
    const userEmail = req.query.user_email;
    try {
        response.success(req, res, {
            "user_permissions": {
                "role": "gestor",
                "modules": [
                    {
                        "module_id": 1,
                        "module_code": "sync",
                        "submodules": [
                            { "submodule_id": 3, "submodule_code": "usuarios" },
                            { "submodule_id": 4, "submodule_code": "cursos" }
                        ]
                    }
                ]
            }
        }, 200)
    } catch (error) {
        response.error(req, res, error.message, 500);
    }
});


module.exports = router