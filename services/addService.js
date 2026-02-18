const axios = require('axios');
const https = require('https'); // Importamos https nativo de Node

const addService = async (endpoint, data) => {
  try {
    // 1. Configurar agente para ignorar certificado SSL auto-firmado
    const agent = new https.Agent({  
      rejectUnauthorized: false
    });

    // 2. Moodle requiere formato "application/x-www-form-urlencoded"
    // Convertimos el objeto JSON a parámetros de URL
    const formData = new URLSearchParams(data).toString();

    // 3. Hacemos la petición
    const res = await axios.post(endpoint, formData, {
      httpsAgent: agent, // Agregamos el agente aquí
      headers: { 
        'Content-Type': 'application/x-www-form-urlencoded'
      },
    });

    // Aquí retornamos la data limpia de axios
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

module.exports = { addService };