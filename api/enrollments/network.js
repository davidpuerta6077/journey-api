const { Router } = require('express');
const response = require('../../network/response')
const router = Router();
const ctrl = require('./index');
const { default: addService } = require('../../services/addService');
const config = require('../../config');
const tableInjected = 'test';



router.post('/enroll_users', async (req, res) => {
    const data = {
        'wstoken': config.moodle_token, 
        'wsfunction': 'enrol_manual_enrol_users', 
        'moodlewsrestformat': 'json', 

        'enrolments[0][roleid]': req.body.roleid,
        'enrolments[0][userid]': req.body.userid,
        'enrolments[0][courseid]': req.body.courseid
             
    }
    try {
        //const result = await addService("https://moodle50.pascualbravovirtual.edu.co/webservice/rest/server.php", data)
        console.log(data)
        response.success(req, res, "result", 200);    
    } catch (error) {
        response.error(req, res, error.message, 500);
    }
});

router.post('/unenroll_users', async (req, res) => {
    const data = {
        'wstoken': config.moodle_token, 
        'wsfunction': 'enrol_manual_unenrol_users', 
        'moodlewsrestformat': 'json', 

        'enrolments[0][roleid]': req.body.roleid,
        'enrolments[0][userid]': req.body.userid,
        'enrolments[0][courseid]': req.body.courseid
             
    }
    try {
        const result = await addService("https://moodle50.pascualbravovirtual.edu.co/webservice/rest/server.php", data)
        console.log(data)
        response.success(req, res, result, 200);    
    } catch (error) {
        response.error(req, res, error.message, 500);
    }
});

router.post('/list_enroll', async (req, res) => {
    const data = {
        'wstoken': config.moodle_token, 
        'wsfunction': 'core_enrol_get_enrolled_users', 
        'moodlewsrestformat': 'json', 

        'enrolments[0][courseid]': req.body.courseid
             
    }
    try {
        //const result = await addService("https://moodle50.pascualbravovirtual.edu.co/webservice/rest/server.php", data)
        console.log(data)
        response.success(req, res, "result", 200);    
    } catch (error) {
        response.error(req, res, error.message, 500);
    }
});


router.get('/list', async (req, res) => {
    try {
        const id = req.params.id
        const list = await ctrl.list(tableInjected, id);
        response.success(req, res, list, 200);    
    } catch (error) {
        response.error(req, res, error.message, 500); 
    }
})


router.post('/add', async (req, res) => {
    try {
        await ctrl.addElement(tableInjected, data = {
            "data": req.body.data,
        });
        response.success(req, res, `Item Created`, 200);    
    } catch (error) {
        response.error(req, res, error.message, 500);
    }
});






router.put('/update', async (req, res) => {
    try {
        let { id, data } = req.body;
        await ctrl.updateElement(tableInjected, data = {
            "id": id,
            "data": data,
        });
        response.success(req, res, `Item updated`, 200);     
    } catch (error) {
        response.error(req, res, error.message, 500);
    }
});

module.exports = router ;