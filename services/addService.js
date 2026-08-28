const axios = require('axios');
// 1. IMPORTAR EL SERVICIO
const awsAuth = require('./AwsAuthService');


const addService = async (endpoint, data) => {
  try {
    // 2. OBTENER TOKEN AUTOMÁTICO
    const token = await awsAuth.getToken();

    const url = `${endpoint}`;
    // 3. AGREGAR HEADER AUTHORIZATION
    const res = await axios.post(url, data, {

      headers: { 
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': token // <-- Token inyectado
      },
    });
    console.log(res.data.message);

    return res.data;

  } catch (error) {
    // Si falla, mostramos el error específico
    console.error("Error en addService:", error.message);
    if (error.response) {
        console.error("Detalle del error:", error.response.data);
    }
    return null;
  }
};


module.exports= {addService};

