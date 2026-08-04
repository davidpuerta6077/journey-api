const express = require('express');
const router = express.Router();
const response = require('../../network/response')
const { login } = require('./index')
const checkAuth = require('../../middleware/checkAuth');

router.post('/login', (req, res) => {
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
                "role": "superadmin",
                "modules": [
                    {
                        "module_id": 1,
                        "module_code": "journey_sync",
                        "submodules": [
                            { "submodule_id": 1, "submodule_code": "journey_home" },
                            { "submodule_id": 2, "submodule_code": "sync_users" },
                            { "submodule_id": 3, "submodule_code": "sync_enrollments" },
                            { "submodule_id": 4, "submodule_code": "sync_courses" },
                            { "submodule_id": 5, "submodule_code": "module_users" },
                            { "submodule_id": 6, "submodule_code": "module_courses" },
                            { "submodule_id": 7, "submodule_code": "module_enrollments" },
                            { "submodule_id": 8, "submodule_code": "bulk_upload_users" },
                            { "submodule_id": 9, "submodule_code": "bulk_upload_enrollments" },
                            { "submodule_id": 10, "submodule_code": "bulk_upload_updates" },
                            { "submodule_id": 11, "submodule_code": "bulk_upload_unenrollments" },
                            { "submodule_id": 12, "submodule_code": "rules_active" },
                            { "submodule_id": 13, "submodule_code": "rules_templates" },
                            { "submodule_id": 14, "submodule_code": "integration_apis" },
                            { "submodule_id": 15, "submodule_code": "reports" },
                            { "submodule_id": 16, "submodule_code": "statistics" },
                            { "submodule_id": 17, "submodule_code": "settings" },
                            { "submodule_id": 18, "submodule_code": "search" }
                        ]
                    },
                    { "module_id": 2, "module_code": "support_center", "submodules": [] },
                    { "module_id": 3, "module_code": "hub", "submodules": [] },
                    { "module_id": 4, "module_code": "sidem", "submodules": [] },
                    { "module_id": 5, "module_code": "monitoring", "submodules": [] },
                    { "module_id": 6, "module_code": "bebras", "submodules": [] },
                    { "module_id": 7, "module_code": "rags", "submodules": [] },
                    { "module_id": 8, "module_code": "onix_reports", "submodules": [] },
                    { "module_id": 9, "module_code": "moodle_builder", "submodules": [] },
                    { "module_id": 10, "module_code": "surveys", "submodules": [] }
                ]
            }
        }, 200)
    } catch (error) {
        response.error(req, res, error.message, 500);
    }
});


module.exports = router