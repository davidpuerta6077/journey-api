const axios = require('axios');
const config = require('../config');

const domain = config.domain.url_base;

const DeleteService = async (endpoint, id) => {
  try {
    const url = `${domain}/${endpoint}/${id}`;
    const res = await axios.delete(url, id, {
      headers: { 'Content-Type': 'application/json' },
    });
    return res.data.body;

  } catch (error) {
    console.error(error);
    return null;
  }
};

export default DeleteService;