import axios from 'axios';
import config from '../config';

const domain = config.domain.url_base;

const AddService = async (endpoint, data) => {
  try {
    const url = `${domain}/${endpoint}`;
    const res = await axios.post(url, data, {
      headers: { 'Content-Type': 'application/json' },
    });
    return res.data.body;

  } catch (error) {
    console.error(error);
    return null;
  }
};

export default AddService;