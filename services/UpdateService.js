import axios from 'axios';
import config from '../config';

const domain = config.domain.url_base;

const UpdateService = async (endpoint, id, data) => {
  try {
    const url = `${domain}/admin/${endpoint}/${id}`;
    const res = await axios.put(url, data, {
      headers: { 'Content-Type': 'application/json' },
    });
    return res.data.body;

  } catch (error) {
    console.error(error);
    return null;
  }
};

export default UpdateService;