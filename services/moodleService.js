const axios = require('axios');
const https = require('https');
const config = require('../config');

const agent = new https.Agent({ rejectUnauthorized: false });

const moodleRequest = async (wsfunction, params) => {
  try {
    const data = new URLSearchParams({
      wstoken: config.moodle_token,
      wsfunction,
      moodlewsrestformat: 'json',
      ...params
    });

    const res = await axios.post(
      'https://moodle50.pascualbravovirtual.edu.co/webservice/rest/server.php',
      data,
      { 
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        httpsAgent: agent
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