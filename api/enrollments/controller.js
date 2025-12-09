module.exports = (injectedDB) => {
    
    let data = injectedDB;
    if (!data) {
        // Manejo básico si no se inyecta DB, para que no rompa la app
        data = require('../../store/mysql'); // O tu store por defecto
    }

    function list(TABLA) {
        return data.list(TABLA);
    }

    async function addElement(TABLA, datas) {
        return data.insert(TABLA, datas);
    }

    async function updateElement(TABLA, datas) {
        return data.updateItem(TABLA, datas);
    }

    return {
        list,
        addElement, 
        updateElement
    };
};