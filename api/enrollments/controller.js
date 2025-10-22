module.exports = (injectedDB) => {
    
    
    let data = injectedDB

    function list(TABLA) {
        return data.listAllRemote(TABLA);
    };

 
    
    async function addElement (TABLA, datas) {
        return data.insertItem(TABLA, datas)
    };

    async function updateElement (TABLA, datas) {
        return data.updateItem(TABLA, datas)
    };

    return {
        list,
        addElement, 
        updateElement
    };
};