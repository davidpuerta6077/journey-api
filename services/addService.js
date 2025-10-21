import axios from 'axios';

const addService = async (endpoint, data) => {
  try {
    const url = `${endpoint}`;
    const res = await axios.post(url, data, {
      headers: { 
        'Content-Type': 'application/x-www-form-urlencoded'
      },
    });
    console.log(res.data.message)
    return res;

  } catch (error) {
    console.error(error);
    return null;
  }
};

export default addService