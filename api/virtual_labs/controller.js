module.exports = (injectedDB) => {

    let data = injectedDB;
    if (!data) data = require('../../database/postgresql');

    async function listLabsGrades() {
        return data.listLabsGrades();
    }

    async function addLabGrade(body) {
        const { id_estudiante, correo, id_curso, calificacion } = body;
        const result = await data.insertLabGrade({ id_estudiante, correo, id_curso, calificacion });
        return result[0];
    }

    return {
        listLabsGrades,
        addLabGrade
    };
};
