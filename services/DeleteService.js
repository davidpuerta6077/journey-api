const axios = require('axios');
const config = require('../config');

// 1. IMPORTAR EL SERVICIO QUE CREASTE (Asegúrate de la ruta correcta)
const awsAuth = require('./AwsAuthService'); 

const domain = config.domain.url_base;

const DeleteService = async (endpoint, id) => {
  try {
    // 2. OBTENER EL TOKEN (Es una sola línea)
    // El servicio se encarga de ver si necesita uno nuevo o usa el caché
    const token = await awsAuth.getToken();

    const url = `${domain}/${endpoint}/${id}`;
    
    // 3. AGREGAR EL HEADER DE AUTORIZACIÓN
    const res = await axios.delete(url, {
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': token // O 'Bearer ' + token, según requiera tu API
      },
      data: id // En axios.delete, si envías body, va en 'data' dentro del config
    });
    
    return res.data.body;

  } catch (error) {
    console.error("Error en DeleteService:", error.message);
    return null;
  }
};

module.exports = { DeleteService };