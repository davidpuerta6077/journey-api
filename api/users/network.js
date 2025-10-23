const { Router } = require('express');
const response = require('../../network/response')
const router = Router();
const ctrl = require('./index');
const { default: addService } = require('../../services/addService');
const config = require('../../config');
const tableInjected = 'test';

router.post('/add_user', async (req, res) => {
    const data = {
        'wstoken': config.moodle_token, 
        'wsfunction': 'core_user_create_users', 
        'moodlewsrestformat': 'json', 

        'users[0][username]': req.body.username,
        'users[0][firstname]': req.body.firstname,
        'users[0][lastname]': req.body.lastname,
        'users[0][email]': req.body.email,
        'users[0][password]': req.body.password,
        'users[0][city]': req.body.city,
        'users[0][country]': req.body.coutry
    }
    try {
        // const result = await addService("https://moodle50.pascualbravovirtual.edu.co/webservice/rest/server.php", data)
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

router.get('/test', async (req, res) => {
    try {
        response.success(req, res, "API Users Working!", 200);    
    } catch (error) {
        response.error(req, res, error.message, 500); 
    }
})

module.exports = router ;