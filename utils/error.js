const err = (mesagge, code)=> {
    let e = new Error(mesagge);
    if (code){
        e.statusCode = code;
    };
    return e; 
};

module.exports = err;