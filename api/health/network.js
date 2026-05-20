const { Router } = require('express');
const router = Router();
const response = require('../../network/response');
const ctrl = require('./index');

router.get('/', async (req, res, next) => {
    try {
        const result = await ctrl.checkHealth();
        response.success(req, res, result, 200);
    } catch (error) {
        response.error(req, res, { status: 'error', db: 'error', message: error.message }, 500);
    }
});

module.exports = router;