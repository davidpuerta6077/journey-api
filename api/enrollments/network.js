const { Router } = require('express');
const response = require('../../network/response');
const router = Router();
const ctrl = require('./index'); // Asegúrate de que el controller exporte las nuevas funciones
const { default: addService } = require('../../services/addService');
const config = require('../../config');
const tableInjected = 'test';
const axios = require('axios');
const path = require('path');
const fs = require('fs');

// ----------------------------------------------------------------------
// RUTAS ESTÁNDAR (Matrícula Manual y Listado)
// ----------------------------------------------------------------------

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
        console.log(data)
        response.success(req, res, "result", 200);
    } catch (error) {
        response.error(req, res, error.message, 500);
    }
});

// ----------------------------------------------------------------------
// RUTAS DE CARGA MASIVA (EXCEL)
// ----------------------------------------------------------------------

// 1. Endpoint ÚNICO para cargar el archivo Excel (sirve para Matrículas y Novedades)
router.post('/upload-excel', async (req, res) => {
    if (!req.files || Object.keys(req.files).length === 0) {
        return response.error(req, res, 'No se ha subido ningún archivo.', 400);
    }

    let excelFile = req.files.excel;
    // Guardamos el archivo temporalmente
    const uploadPath = path.join(__dirname, '../../uploads', `upload_${Date.now()}_${excelFile.name}`);

    try {
        // Asegurar que la carpeta uploads exista
        const dir = path.dirname(uploadPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

        await excelFile.mv(uploadPath);
        response.success(req, res, { message: 'Archivo subido con éxito', filePath: uploadPath }, 200);
    } catch (err) {
        console.error(err);
        response.error(req, res, 'Error al subir el archivo.', 500);
    }
});

// 2. Endpoint para procesar MATRÍCULAS (Crear usuarios / Matricular)
router.post('/process-excel', async (req, res) => {
    const { filePath } = req.body;

    if (!filePath) {
        return response.error(req, res, 'No se ha especificado la ruta del archivo.', 400);
    }

    try {
        // Llamamos a la función de MATRICULAR en el controlador
        const result = await ctrl.processExcelAndEnrolUsers(filePath, config.moodle_token); // Nota: quité addService como parámetro ya que lo arreglamos en el controller

        if (result.errors.length > 0) {
            const errorExcelPath = await ctrl.generateErrorExcel(result.errors);
            response.success(req, res, {
                message: 'Proceso de matrículas con errores.',
                successCount: result.successCount,
                errorCount: result.errorCount,
                errorFileUrl: `/uploads/${path.basename(errorExcelPath)}`
            }, 200);
        } else {
            response.success(req, res, { message: 'Matrículas exitosas.', successCount: result.successCount }, 200);
        }
    } catch (error) {
        console.error("Error matrículas:", error);
        response.error(req, res, `Error procesando matrículas: ${error.message}`, 500);
    } finally {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath); // Borrar archivo temp
    }
});

// 3. NUEVO: Endpoint para procesar NOVEDADES (Suspender usuarios)
router.post('/process-novedades', async (req, res) => {
    const { filePath } = req.body;

    if (!filePath) {
        return response.error(req, res, 'No se ha especificado la ruta del archivo.', 400);
    }

    try {
        // Llamamos a la función de SUSPENDER en el controlador
        // Asegúrate de que esta función exista en tu controller.js
        const result = await ctrl.processExcelAndSuspendUsers(filePath, config.moodle_token); 

        if (result.errors.length > 0) {
            const errorExcelPath = await ctrl.generateErrorExcel(result.errors);
            response.success(req, res, {
                message: 'Proceso de novedades completado con errores.',
                successCount: result.successCount,
                errorCount: result.errorCount,
                errorFileUrl: `/uploads/${path.basename(errorExcelPath)}`
            }, 200);
        } else {
            response.success(req, res, { message: 'Usuarios suspendidos con éxito.', successCount: result.successCount }, 200);
        }
    } catch (error) {
        console.error("Error novedades:", error);
        response.error(req, res, `Error procesando novedades: ${error.message}`, 500);
    } finally {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath); // Borrar archivo temp
    }
});


// ----------------------------------------------------------------------
// RUTAS DE BASE DE DATOS (CRUD Genérico)
// ----------------------------------------------------------------------

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

module.exports = router;