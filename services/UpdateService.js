const axios = require('axios');
const config = require('../config');

// 1. IMPORTAR EL SERVICIO
const awsAuth = require('./AwsAuthService');


const domain = config.domain.url_base;

const UpdateService = async (endpoint, id, data) => {
  try {
    // 2. OBTENER TOKEN AUTOMÁTICO
    const token = await awsAuth.getToken();

    // Nota: Mantuve tu ruta /admin/ que tenías en el ejemplo original
    const url = `${domain}/admin/${endpoint}/${id}`;
    
    // 3. AGREGAR HEADER AUTHORIZATION
    const res = await axios.put(url, data, {
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': token // <-- Token inyectado
      },
    });
    return res.data.body;

  } catch (error) {
    console.error("Error en UpdateService:", error.message);
    return null;
  }
};

module.exports= {UpdateService};