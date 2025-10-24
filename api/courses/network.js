const { Router } = require('express');
const response = require('../../network/response')
const router = Router();
const ctrl = require('./index');
const { default: addService } = require('../../services/addService');
const config = require('../../config');
const tableInjected = 'test';

router.post('/add_course', async (req, res) => {
    const data = {
        'wstoken': config.moodle_token, 
        'wsfunction': 'core_course_create_courses', 
        'moodlewsrestformat': 'json', 

        'courses[0][fullname]': req.body.fullname,
        'courses[0][shortname]': req.body.shortname,
        'courses[0][categoryid]': req.body.categoryid,
        'courses[0][idnumber]': req.body.idnumber,
        'courses[0][summary]': req.body.summary,
        'courses[0][visible]': req.body.visible,
        'courses[0][format]': req.body.format,
        'courses[0][numsections]': req.body.numsections,
        
    }
    try {
        //const result = await addService("https://moodle50.pascualbravovirtual.edu.co/webservice/rest/server.php", data)
        console.log(data)
        response.success(req, res, "result", 200);    
    } catch (error) {
        response.error(req, res, error.message, 500);
    }
});

router.post('/duplicate_course', async (req, res) => {
    const data = {
        'wstoken': config.moodle_token, 
        'wsfunction': 'core_course_duplicate_course', 
        'moodlewsrestformat': 'json', 

        'courseid': req.body.courseid,
        'fullname': req.body.fullname,
        'shortname': req.body.shortname,
        'categoryid': req.body.categoryid
        
    }
    try {
        //const result = await addService("https://moodle50.pascualbravovirtual.edu.co/webservice/rest/server.php", data)
        console.log(data)
        response.success(req, res, "result", 200);    
    } catch (error) {
        response.error(req, res, error.message, 500);
    }
});

router.post('/update_course', async (req, res) => {
    const data = {
        'wstoken': config.moodle_token, 
        'wsfunction': 'core_course_update_courses', 
        'moodlewsrestformat': 'json', 

        'courses[0][id]': req.body.id,
        'courses[0][fullname]': req.body.fullname,
        'courses[0][shortname]': req.body.shortname,
        'courses[0][categoryid]': req.body.categoryid,
        'courses[0][idnumber]': req.body.idnumber,
        'courses[0][summary]': req.body.summary,
        'courses[0][visible]': req.body.visible,
        'courses[0][format]': req.body.format
        
    }
    try {
        //const result = await addService("https://moodle50.pascualbravovirtual.edu.co/webservice/rest/server.php", data)
        console.log(data)
        response.success(req, res, "result", 200);    
    } catch (error) {
        response.error(req, res, error.message, 500);
    }
});


router.post('/delete_course', async (req, res) => {
    const data = {
        'wstoken': config.moodle_token, 
        'wsfunction': 'core_course_delete_courses', 
        'moodlewsrestformat': 'json', 

        'courseids[0]': req.body.courseids
        
    }
    try {
        //const result = await addService("https://moodle50.pascualbravovirtual.edu.co/webservice/rest/server.php", data)
        console.log(data)
        response.success(req, res, "result", 200);    
    } catch (error) {
        response.error(req, res, error.message, 500);
    }
});


 router.post('/search_course', async (req, res) => {
    const data = {
        'wstoken': config.moodle_token, 
        'wsfunction': 'core_course_get_courses_by_field', 
        'moodlewsrestformat': 'json', 

        'field': req.body.field,
        'value': req.body.value
        
    }
    try {
        //const result = await addService("https://moodle50.pascualbravovirtual.edu.co/webservice/rest/server.php", data)
        console.log(data)
        response.success(req, res, "result", 200);    
    } catch (error) {
        response.error(req, res, error.message, 500);
    }
});


router.post('/list_course', async (req, res) => {
    const data = {
        'wstoken': config.moodle_token, 
        'wsfunction': 'core_course_get_courses_by_field', 
        'moodlewsrestformat': 'json'

        
        
    }
    try {
        //const result = await addService("https://moodle50.pascualbravovirtual.edu.co/webservice/rest/server.php", data)
        console.log(data)
        response.success(req, res, "result", 200);    
    } catch (error) {
        response.error(req, res, error.message, 500);
    }
});

router.post('/list_course_content', async (req, res) => {
    const data = {
        'wstoken': config.moodle_token, 
        'wsfunction': 'core_course_get_contents', 
        'moodlewsrestformat': 'json' 

        
    }
    try {
        const result = await addService("https://moodle50.pascualbravovirtual.edu.co/webservice/rest/server.php", data)
        console.log(data)
        response.success(req, res, "result", 200);    
    } catch (error) {
        response.error(req, res, error.message, 500);
    }
});

router.post('/add_category', async (req, res) => {
    const data = {
        'wstoken': config.moodle_token, 
        'wsfunction': 'core_course_create_categories', 
        'moodlewsrestformat': 'json', 

        'categories[0][name]': req.body.name,
        'categories[0][parent]': req.body.parent,
        'categories[0][idnumber]': req.body.idnumber,
        'categories[0][description]': req.body.description,
        'categories[0][descriptionformat]': req.body.descriptionformat        
    }
    try {
        //const result = await addService("https://moodle50.pascualbravovirtual.edu.co/webservice/rest/server.php", data)
        console.log(data)
        response.success(req, res, "result", 200);    
    } catch (error) {
        response.error(req, res, error.message, 500);
    }
});


router.post('/list_category', async (req, res) => {
    const data = {
        'wstoken': config.moodle_token, 
        'wsfunction': 'core_course_get_categories', 
        'moodlewsrestformat': 'json'
    }
    try {
        const result = await addService("https://moodle50.pascualbravovirtual.edu.co/webservice/rest/server.php", data)
        console.log(data)
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