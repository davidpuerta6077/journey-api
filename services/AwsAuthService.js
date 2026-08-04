/**
 * AwsAuthService.js
 * Servicio para manejar la autenticación con AWS Cognito en el Backend (Node.js)
 * 
 */

const axios = require('axios');
const config_aws = require('../config');

class AwsAuthService {
  constructor() {
    this.token = null;
    this.tokenExpiration = 0; // Timestamp en segundos
    
    // CONFIGURACIÓN (Mover a variables de entorno .env en producción)
    this.config = {
      tokenEndpoint: config_aws.aws.tokenEndpoint,
      clientId: config_aws.aws.clientId,
      clientSecret: config_aws.aws.clientSecret,
      scope: config_aws.aws.scope
    };
  }

  /**
   * Obtiene un token válido. 
   * Si ya existe uno en memoria y no ha expirado, lo devuelve (Caché).
   * Si no, solicita uno nuevo a AWS.
   */
  async getToken() {
    if (this.isTokenValid()) {
      console.log('Usando token AWS en caché');
      return this.token;
    }

    console.log('Solicitando nuevo token a AWS Cognito...');
    return await this.fetchNewToken();
  }

  /**
   * Verifica si el token actual sigue siendo válido
   * (con un margen de seguridad de 60 segundos)
   */
  isTokenValid() {
    if (!this.token) return false;
    const now = Math.floor(Date.now() / 1000);
    // Margen de seguridad: renovar si faltan menos de 1 minuto
    return now < (this.tokenExpiration - 60);
  }

  /**
   * Realiza la petición HTTP real a AWS
   */
  async fetchNewToken() {
    try {
      const params = new URLSearchParams();
      params.append('grant_type', 'client_credentials');
      params.append('client_id', this.config.clientId);
      params.append('client_secret', this.config.clientSecret);
      if (this.config.scope) {
        params.append('scope', this.config.scope);
      }

      const response = await axios.post(this.config.tokenEndpoint, params, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });

      const { access_token, expires_in } = response.data;

      // Guardar en memoria
      this.token = access_token;
      // Calcular expiración absoluta (Ahora + Segundos de vida)
      this.tokenExpiration = Math.floor(Date.now() / 1000) + expires_in;

      console.log('Nuevo token AWS obtenido. Expira en:', expires_in, 'segundos');
      return this.token;

    } catch (error) {
      console.error('Error obteniendo token AWS:', error.response ? error.response.data : error.message);
      throw new Error('Fallo crítico en autenticación AWS');
    }
  }
}

// Exportar como Singleton (una sola instancia para toda la app)
module.exports = new AwsAuthService();