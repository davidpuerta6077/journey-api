module.exports = (injectedDB) => {
    
    let data = injectedDB;
    // Fallback por si no se inyecta DB (opcional)
    if (!data) data = require('../../store/mysql'); 

    function list(TABLA) {
        return data.list(TABLA);
    }

    async function addElement(TABLA, datas) {
        return data.insert(TABLA, datas);
    }

    async function updateElement(TABLA, datas) {
        return data.update(TABLA, datas);
    }

    return {
        list,
        addElement, 
        updateElement
    };
};