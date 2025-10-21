const { Router } = require('express');
const response = require('../../network/response')
const router = Router();
const ctrl = require('./index');
const { default: addService } = require('../../services/addService');
const tableInjected = 'test';



router.post('/add_user', async (req, res) => {
    const data = {
        'wstoken': '296ff6f74da897b46aeba8b5b533e92a', 
        'wsfunction': 'core_user_create_users', 
        'moodlewsrestformat': 'json', 
        'users[0][username]': 'programador.digital3@pascualbravo.edu.co',
        'users[0][lastname]': 'Arango',
        'users[0][email]': 'programador.digital3@pascualbravo.edu.co',
        'users[0][password]': 'Eve_0996',
        'users[0][city]': 'Medellín',
        'users[0][country]': 'CO'
    }
    try {
        const result = await addService("https://moodle50.pascualbravovirtual.edu.co/webservice/rest/server.php", data)
        response.success(req, res, result, 200);    
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