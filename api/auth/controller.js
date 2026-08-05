const auth = require('../../auth/index')
const bcrypt = require('bcrypt');


module.exports = (database) => {
    let store = database
    let data = database;
    if (!data) data = require('../../database/postgresql');

    const authUpsert = async (body) => {
        const authData = {}

        if (data.username) {
            authData.name = body.name;
        };
        
        if (data.username) {
            authData.username = body.username;
        };

        if (data.password){
            authData.password = await bcrypt.hash(body.password, 5);
        };

        return store.insertNewAuth(authData)
    };

    const login = async (user_email) => {

        //const data = await store.itemByEmail('users', user_email);
        //const emailSend = data[0]['email'];
        
        const emailSend = "test@gamil.com";
        const emailRecived = user_email;

        //const payload = { roles_id: data[0]["roles_id"], email: data[0]["email"] };
        const payload = { roles_id: "admin", email: "test@gmail.com" };

        try {
          const result = emailRecived === emailSend;
          if (true) {
            //return {token: auth.sign(payload), profile: data[0]["type"]};
            return {token: auth.sign(payload), profile: "admin"};
          } else {
            throw new Error('Credenciales invalidas');
          }
        } catch (e) {
          throw new Error('Error al comparar los emails');
        }
      };

    const addElement = async (data) => {
        const user = {
            name: data.name,
            username: data.username,
            password: data.password,
        };

        if (data.password || data.username){
            await authUpsert(user);
        };

        return store.insertNewUser(user);
    };

    async function permissions(email) {
        return data.checkPermissionsData(email);
    }


    return {
        authUpsert,
        login,
        addElement, 
        permissions
    }
};