const axios = require('axios');
const config = require('../config');

const domain = config.domain.url_base;

const GetService = async (endpoint) => {
    try {
        const url = (`${domain}/${endpoint}`)
        const res = await axios.get(url)
        detail(res.data.body)
        
    } catch (error) {
        console.error(error);
        detail(null);
    }
    return detail
}

module.exports={GetService};