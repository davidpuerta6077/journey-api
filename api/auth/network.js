const express = require('express');
const router = express.Router();
const response = require('../../network/response')
const {login} = require('./index')

router.post('/login', (req, res) =>{
    console.log(req.body)
    login(req.body.user_email)
        .then(token => {
            response.success(req, res, token, 200)
        })
        .catch(e => {
            response.error(req, res, `Denegado ${e}`, 405)
        });
});


module.exports = router