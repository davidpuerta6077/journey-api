// URL base de tu API (ajusta el puerto si es necesario, express suele ser 3000 o 4000)
// Asumiendo que el archivo de rutas está montado en /api
const API_URL = 'http://localhost:3000/api'; 

document.addEventListener('DOMContentLoaded', () => {
    
    // Manejo del botón Guardar en el Modal
    const btnGuardar = document.getElementById('btnGuardar');
    btnGuardar.addEventListener('click', async (e) => {
        e.preventDefault();
        await createUser();
    });

    // Opcional: Cargar usuarios al inicio (si tienes un endpoint para listar todos)
    // loadUsers();
});

/**
 * Función para crear usuario consumiendo el endpoint /add_user
 */
async function createUser() {
    const form = document.getElementById('formAddUser');
    const formData = new FormData(form);

    // Convertir FormData a JSON plano como lo espera tu backend
    // Tu backend espera: username, firstname, lastname, email, password, city, coutry
    const data = {};
    formData.forEach((value, key) => {
        data[key] = value;
    });

    try {
        const response = await fetch(`${API_URL}/add_user`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });

        const result = await response.json();

        if (response.ok) {
            alert('Usuario creado correctamente');
            // Cerrar modal
            const modalEl = document.getElementById('modalNuevoUsuario');
            const modal = bootstrap.Modal.getInstance(modalEl);
            modal.hide();
            
            // Limpiar formulario
            form.reset();
            
            // Aquí podrías recargar la tabla si tuvieras el endpoint de lista
            console.log("Respuesta Moodle:", result);
        } else {
            alert('Error al crear usuario: ' + (result.body || 'Error desconocido'));
        }

    } catch (error) {
        console.error('Error de red:', error);
        alert('Hubo un error al conectar con el servidor');
    }
}

/**
 * Función para buscar usuarios (Ejemplo para el buscador)
 */
async function searchUser(criteriaKey, criteriaValue) {
    try {
        const response = await fetch(`${API_URL}/search_user`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                key: criteriaKey,   // ej: "email"
                value: criteriaValue // ej: "roger@gmail.com"
            })
        });
        const result = await response.json();
        console.log("Resultados búsqueda:", result);
        // Aquí lógica para pintar la tabla con los resultados
    } catch (error) {
        console.error(error);
    }
}

/**
 * Función para eliminar usuario (Conectado al icono de basura)
 */
async function deleteUser(userId) {
    if(!confirm("¿Está seguro de eliminar este usuario?")) return;

    try {
        const response = await fetch(`${API_URL}/delete_user`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userids: [userId] })
        });
        const result = await response.json();
        if(response.ok) {
            alert("Usuario eliminado");
            // Recargar tabla
        }
    } catch (error) {
        console.error(error);
    }
}