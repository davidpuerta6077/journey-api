const axios = require('axios');
const https = require('https');
const config = require('../config');
const postgresql = require('../database/postgresql');

const agent = new https.Agent({ rejectUnauthorized: false });

// La URL/token de Moodle se pueden sobrescribir desde Configuración (settings
// categoría "moodle"); se cachean unos segundos para no pegarle a la BD en
// cada llamada durante un sync masivo (cientos de requests seguidos).
let moodleConfigCache = null;
let moodleConfigCacheAt = 0;
const MOODLE_CONFIG_TTL_MS = 60000;

async function getMoodleConfig() {
  const now = Date.now();
  if (moodleConfigCache && (now - moodleConfigCacheAt) < MOODLE_CONFIG_TTL_MS) return moodleConfigCache;
  let porClave = {};
  try {
    const settings = await postgresql.getSettings('moodle');
    porClave = Object.fromEntries(settings.map(s => [s.clave, s.valor]));
  } catch { /* si falla la BD, se sigue con los defaults de config.js */ }
  moodleConfigCache = {
    url: porClave.moodle_url || config.moodle.url,
    token: porClave.moodle_token || config.moodle.token,
  };
  moodleConfigCacheAt = now;
  return moodleConfigCache;
}

const moodleRequest = async (wsfunction, params, timeoutMs = 15000, token) => {
  try {
    const moodleConfig = await getMoodleConfig();
    const data = new URLSearchParams({
      wstoken: token || moodleConfig.token,
      wsfunction,
      moodlewsrestformat: 'json',
      ...params
    });

const res = await axios.post(
      moodleConfig.url,
      data,
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        httpsAgent: agent,
        timeout: timeoutMs
      }
    );

    console.log(`Moodle [${wsfunction}]:`, res.data);
    return res.data;
  } catch (error) {
    console.error(`Moodle error [${wsfunction}]:`, error.response?.data || error.message);
    return null;
  }
};



module.exports = { moodleRequest };