const { Router } = require('express');
const response = require('../../network/response')
const router = Router();
const ctrl = require('./index');
const { default: addService } = require('../../services/addService');
const config = require('../../config');
const tableInjected = 'test';
const axios = require('axios');
const path = require('path');  
const fs = require('fs');


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



// Endpoint para cargar el archivo Excel de matrículas
router.post('/upload-excel', async (req, res) => {
    if (!req.files || Object.keys(req.files).length === 0) {
        return response.error(req, res, 'No se ha subido ningún archivo.', 400);
    }

    let excelFile = req.files.excel;
    const uploadPath = path.join(__dirname, '../../uploads', excelFile.name);

    try {
        await excelFile.mv(uploadPath);
        response.success(req, res, { message: 'Archivo de matrículas subido con éxito', filePath: uploadPath }, 200);
    } catch (err) {
        console.error(err);
        response.error(req, res, 'Error al subir el archivo de matrículas.', 500);
    }
});

// Endpoint para procesar el archivo Excel y matricular usuarios en Moodle
router.post('/process-excel', async (req, res) => {
    const { filePath } = req.body;

    if (!filePath) {
        return response.error(req, res, 'No se ha especificado la ruta del archivo de matrículas a procesar.', 400);
    }

    try {
        // Pasa moodleToken y la función addService (si se define aquí o se inyecta) al controlador
        const result = await ctrl.processExcelAndEnrolUsers(filePath, config.moodle_token, addService);

        if (result.errors.length > 0) {
            const errorExcelPath = await ctrl.generateErrorExcel(result.errors);
            response.success(req, res, {
                message: 'Proceso de matrículas completado con errores. Descargue el archivo de errores.',
                successCount: result.successCount,
                errorCount: result.errorCount,
                errorFileUrl: `/uploads/${path.basename(errorExcelPath)}`
            }, 200);
        } else {
            response.success(req, res, { message: 'Usuarios matriculados con éxito.', successCount: result.successCount }, 200);
        }
    } catch (error) {
        console.error("Error al procesar el archivo Excel de matrículas:", error);
        response.error(req, res, `Error interno al procesar el archivo Excel de matrículas: ${error.message}`, 500);
    } finally {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
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