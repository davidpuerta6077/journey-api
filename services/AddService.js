import axios from 'axios';

const AddService = async (endpoint, data) => {
  try {
    const url = `${endpoint}`;
    const res = await axios.post(url, data, {
      headers: { 
        'Content-Type': 'application/json', 
        'wstoken': '296ff6f74da897b46aeba8b5b533e92a', 
      },
    });
    return res;

  } catch (error) {
    console.error(error);
    return null;
  }
};

export default AddService;