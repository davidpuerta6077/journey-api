const { Router } = require('express');
const multer = require('multer');
const XLSX = require('xlsx');
const fs = require('fs');
const axios = require('axios');
const path = require('path');
const response = require('../../network/response')
const router = Router();
const ctrl = require('./index');
const { default: addService } = require('../../services/addService');
const config = require('../../config');
const controller = require('./controller');




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
        const result = await addService("https://moodle50.pascualbravovirtual.edu.co/webservice/rest/server.php", data)
        console.log(data)
        response.success(req, res, result, 200);    
    } catch (error) {
        response.error(req, res, error.message, 500);
    }
});

router.post('/update_user', async (req, res) => {
    const data = {
        'wstoken': config.moodle_token, 
        'wsfunction': 'core_user_update_users', 
        'moodlewsrestformat': 'json', 

        'users[0][id]': req.body.id,
        'users[0][firstname]': req.body.firstname,
        'users[0][lastname]': req.body.lastname,
        'users[0][email]': req.body.email,
        'users[0][password]': req.body.password,
        'users[0][city]': req.body.city
        
    }
    try {
        //const result = await addService("https://moodle50.pascualbravovirtual.edu.co/webservice/rest/server.php", data)
        console.log(data)
        response.success(req, res, "result", 200);    
    } catch (error) {
        response.error(req, res, error.message, 500);
    }
});
router.post('/delete_user', async (req, res) => {
    const data = {
        'wstoken': config.moodle_token, 
        'wsfunction': 'core_user_delete_users', 
        'moodlewsrestformat': 'json', 

        'userids[0]': req.body.userids
       
        
    }
    try {
        //const result = await addService("https://moodle50.pascualbravovirtual.edu.co/webservice/rest/server.php", data)
        console.log(data)
        response.success(req, res, "result", 200);    
    } catch (error) {
        response.error(req, res, error.message, 500);
    }
});

router.post('/search_user', async (req, res) => {
    const data = {
        'wstoken': config.moodle_token, 
        'wsfunction': 'core_user_get_users', 
        'moodlewsrestformat': 'json', 

        'criteria[0][key]': req.body.key,
        'criteria[0][value]	': req.body.value
    }
    try {
        //const result = await addService("https://moodle50.pascualbravovirtual.edu.co/webservice/rest/server.php", data)
        console.log(data)
        response.success(req, res, "result", 200);    
    } catch (error) {
        response.error(req, res, error.message, 500);
    }
});

// Endpoint para cargar el archivo Excel
router.post('/upload-excel', async (req, res) => {
    if (!req.files || Object.keys(req.files).length === 0) {
        return response.error(req, res, 'No se ha subido ningún archivo.', 400);
    }

    let excelFile = req.files.excel;
    const uploadPath = path.join(__dirname, '../../uploads', excelFile.name);

    try {
        await excelFile.mv(uploadPath);
        response.success(req, res, { message: 'Archivo subido con éxito', filePath: uploadPath }, 200);
    } catch (err) {
        console.error(err);
        response.error(req, res, 'Error al subir el archivo.', 500);
    }
});

// Endpoint para procesar el archivo Excel y crear usuarios en Moodle
router.post('/process-excel', async (req, res) => {
    const { filePath } = req.body;

    if (!filePath) {
        return response.error(req, res, 'No se ha especificado la ruta del archivo a procesar.', 400);
    }

    try {
        const result = await controller.processExcelAndCreateUsers(filePath, config.moodle_token);

        if (result.errors.length > 0) {
            const errorExcelPath = await controller.generateErrorExcel(result.errors);
            response.success(req, res, {
                message: 'Proceso completado con errores. Descargue el archivo de errores.',
                successCount: result.successCount,
                errorCount: result.errorCount,
                errorFileUrl: `/uploads/${path.basename(errorExcelPath)}`
            }, 200);
        } else {
            response.success(req, res, { message: 'Usuarios cargados con éxito.', successCount: result.successCount }, 200);
        }
    } catch (error) {
        console.error("Error al procesar el archivo Excel:", error);
        response.error(req, res, `Error interno al procesar el archivo Excel: ${error.message}`, 500);
    } finally {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    }
});



module.exports = router ;