const { Router } = require('express');
const response = require('../../network/response')
const router = Router();
const ctrl = require('./index');
const { addService } = require('../../services/addService');
const config = require('../../config');
const tableInjected = 'test';

// router.post('/grades_user', async (req, res) => {
//     const data = {
//         'wstoken': config.moodle_token, 
//         'wsfunction': 'gradereport_user_get_grade_items', 
//         'moodlewsrestformat': 'json', 

//         'courseid': req.body.courseid,
//         'userid': req.body.userid
    
//     }
//     try {
//         // const result = await addService("https://moodle50.pascualbravovirtual.edu.co/webservice/rest/server.php", data)
//         console.log(data)
//         response.success(req, res, "result", 200);    
//     } catch (error) {
//         response.error(req, res, error.message, 500);
//     }
// });


router.post('/grades_user', async (req, res) => {
    
    // 2. Armamos el paquete de datos para Moodle
    const data = {
        'wstoken': config.moodle_token, // El token generado en Moodle
        'wsfunction': 'gradereport_user_get_grade_items', 
        'moodlewsrestformat': 'json', 
        'courseid': req.body.courseid,
        'userid': req.body.userid
    };

    try {
        console.log("--> Solicitando notas a Moodle...");

        // 3. Llamamos al servicio (la URL debe ser la de tu Moodle)
        const result = await addService(
            "https://moodle50.pascualbravovirtual.edu.co/webservice/rest/server.php", 
            data
        );

        // Validamos si falló la conexión
        if (!result) {
            throw new Error("No se pudo conectar con Moodle o el certificado falló.");
        }

        // Validamos si Moodle devolvió un error de token o permisos
        if (result.exception) {
            console.log("❌ Error devuelto por Moodle:", result.message);
            return response.error(req, res, result.message, 400);
        }

        // 4. AQUÍ ESTÁ LO QUE PEDISTE: El Console Log con las notas
        console.log("✅ ¡Notas obtenidas con éxito!");
        console.log(JSON.stringify(result, null, 2)); // Muestra todo el JSON ordenado

        // 5. Enviamos la respuesta al cliente (Frontend / Postman)
        response.success(req, res, result, 200);    

    } catch (error) {
        console.error("Error en el endpoint:", error);
        response.error(req, res, error.message, 500);
    }
});

router.post('/book_grades', async (req, res) => {
    const data = {
        'wstoken': config.moodle_token, 
        'wsfunction': 'core_grades_get_grade_tree', 
        'moodlewsrestformat': 'json', 

        'courseid': req.body.courseid
    }
    try {
        //const result = await addService("https://moodle50.pascualbravovirtual.edu.co/webservice/rest/server.php", data)
        console.log(data)
        response.success(req, res, "result", 200);    
    } catch (error) {
        response.error(req, res, error.message, 500);
    }
});

router.post('/grades_user_table', async (req, res) => {
    const data = {
        'wstoken': config.moodle_token, 
        'wsfunction': 'gradereport_user_get_grade_items', 
        'moodlewsrestformat': 'json', 

        'courseid': req.body.courseid,
        'userid': req.body.userid
    
    }
    try {
        // const result = await addService("https://moodle50.pascualbravovirtual.edu.co/webservice/rest/server.php", data)
        console.log(data)
        response.success(req, res, "result", 200);    
    } catch (error) {
        response.error(req, res, error.message, 500);
    }
});
+

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