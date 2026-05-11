const axios = require('axios');
const config = require('../config');

// 1. IMPORTAR EL SERVICIO
const awsAuth = require('./AwsAuthService');

const domain = config.domain.url_base;

const GetService = async (endpoint) => {
    try {
        // 2. OBTENER TOKEN AUTOMÁTICO
        const token = await awsAuth.getToken();

        const url = `${domain}/${endpoint}`;
        
        // 3. AGREGAR HEADER AUTHORIZATION
        const res = await axios.get(url, {
           headers: {
             'Content-Type': 'application/json',
             'Authorization': token // <-- Token inyectado
           }
        });

        // Retornamos el body directamente (asumiendo que 'detail' era tu callback de éxito)
        return res.data.body;
        
    } catch (error) {
        console.error("Error en GetService:", error.message);
        return null; // O manejar el error como prefieras (ej. llamar a detail(null))
    }
}

module.exports = { GetService };