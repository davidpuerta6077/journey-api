const API_BASE = 'http://localhost:3001'; 
const USERS_URL = `${API_BASE}/users`; 

// Variables globales
let GLOBAL_USERS = []; // Aquí guardaremos TODOS los datos originales
let editingUserId = null; 
let currentSort = { column: null, direction: 'asc' };

document.addEventListener('DOMContentLoaded', () => {
    // 1. Cargar TODOS los usuarios al iniciar (enviamos '%' para traer todo)
    loadUsers('%');

    // 2. BUSCADOR EN TIEMPO REAL (LOCAL)
    // Ya no llama al servidor, filtra lo que ya tenemos.
    const searchInput = document.getElementById('globalSearch');
    if(searchInput){
        searchInput.addEventListener('keyup', (e) => {
            const term = e.target.value.toLowerCase();
            filterLocalUsers(term);
        });
    }

    // Configuración del Modal
    const form = document.getElementById('formAddUser');
    if(form){
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            editingUserId ? await updateUser() : await createUser();
        });
        
        const modalEl = document.getElementById('modalNuevoUsuario');
        modalEl.addEventListener('hidden.bs.modal', () => {
            form.reset();
            editingUserId = null;
            document.querySelector('.modal-title').textContent = "Nuevo usuario plataforma";
            document.querySelector('.btn-custom-save').innerHTML = 'Guardar usuario <i class="bi bi-save ms-2"></i>';
        });
    }
});

/**
 * FUNCIÓN 1: CARGAR DATOS DEL SERVIDOR
 */
async function loadUsers(search = '%') {
    const tbody = document.querySelector('#usersTable tbody');
    tbody.innerHTML = '<tr><td colspan="7" class="text-center">Cargando datos de Moodle...</td></tr>';

    try {
        const response = await fetch(`${USERS_URL}/get_users?search=${search}`);
        const result = await response.json();
        
        // Guardamos la copia MAESTRA de los datos
        GLOBAL_USERS = result.body || []; 

        if (GLOBAL_USERS.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center">No se encontraron usuarios</td></tr>';
            calculateStats([]);
            return;
        }

        calculateStats(GLOBAL_USERS); // Stats iniciales
        renderTable(GLOBAL_USERS);    // Tabla inicial

    } catch (error) {
        console.error('Error:', error);
        tbody.innerHTML = `<tr><td colspan="7" class="text-center text-danger">Error de conexión con el API</td></tr>`;
    }
}

/**
 * FUNCIÓN 2: FILTRADO LOCAL (LA SOLUCIÓN A TU PROBLEMA)
 * Busca en Nombre O Apellido O Correo O Documento
 */
function filterLocalUsers(term) {
    if (!term) {
        // Si borran el texto, mostramos todo de nuevo
        renderTable(GLOBAL_USERS);
        return;
    }

    // Filtramos la lista global
    const filtered = GLOBAL_USERS.filter(user => {
        const name = (user.firstname || '').toLowerCase();
        const last = (user.lastname || '').toLowerCase();
        const email = (user.email || '').toLowerCase();
        const doc = (user.idnumber || '').toLowerCase();

        // Devuelve TRUE si alguno de los campos incluye el término
        return name.includes(term) || last.includes(term) || email.includes(term) || doc.includes(term);
    });

    renderTable(filtered);
}

/**
 * FUNCIÓN 3: PINTAR TABLA
 */
function renderTable(usersList) {
    const tbody = document.querySelector('#usersTable tbody');
    tbody.innerHTML = '';

    if (usersList.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted">No hay coincidencias</td></tr>';
        return;
    }

    usersList.forEach(user => {
        const tr = document.createElement('tr');
        
        // Lógica de Estado
        const isSuspended = user.suspended == true || user.suspended == 1;
        
        const statusBadge = isSuspended 
            ? '<span class="badge bg-danger">Suspendido</span>' 
            : '<span class="badge bg-success">Activo</span>';

        const actionButton = isSuspended 
            ? `<button class="btn btn-sm text-success" onclick="toggleUserStatus(${user.id}, 0)" title="Reactivar usuario"><i class="bi bi-check-circle-fill"></i></button>`
            : `<button class="btn btn-sm text-danger" onclick="deleteUser(${user.id})" title="Suspender usuario"><i class="bi bi-trash-fill"></i></button>`;

        const documento = user.idnumber || 'N/A';
        const celular = user.phone1 || ''; // Recuperamos el celular

        tr.className = isSuspended ? 'table-light text-muted' : '';

        tr.innerHTML = `
            <td>${user.id}</td>
            <td>${user.firstname}</td>
            <td>${user.lastname}</td>
            <td>${user.email}</td>
            <td>${documento}</td>
            
            <!-- COLUMNA CELULAR RESTAURADA -->
            <td>${celular}</td>
            
            <!-- COLUMNA ESTADO -->
            <td>${statusBadge}</td>

            <td class="text-end">
                <button class="btn btn-sm text-dark" onclick='prepareEdit(${JSON.stringify(user)})'><i class="bi bi-pencil-fill"></i></button>
                <button class="btn btn-sm text-dark" onclick="resetPassword(${user.id}, '${documento}')"><i class="bi bi-arrow-counterclockwise"></i></button>
                ${actionButton}
            </td>
        `;
        tbody.appendChild(tr);
    });
}

/**
 * FUNCIÓN 4: ORDENAR (Actualizada para usar currentSort)
 */
window.sortUsers = function(key) {
    // Ordenamos siempre sobre GLOBAL_USERS para no perder datos,
    // pero idealmente deberíamos ordenar lo que se está viendo. 
    // Para simplificar, ordenamos GLOBAL y repintamos.
    
    if (currentSort.column === key) {
        currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
    } else {
        currentSort.column = key;
        currentSort.direction = 'asc';
    }

    updateHeaderIcons(key, currentSort.direction);

    // Nota: Usamos una variable temporal para no romper el GLOBAL original si quisieras
    GLOBAL_USERS.sort((a, b) => {
        let valA = a[key] ? a[key].toString().toLowerCase() : '';
        let valB = b[key] ? b[key].toString().toLowerCase() : '';

        if (key === 'id') {
            valA = parseInt(a[key]) || 0;
            valB = parseInt(b[key]) || 0;
        }

        if (valA < valB) return currentSort.direction === 'asc' ? -1 : 1;
        if (valA > valB) return currentSort.direction === 'asc' ? 1 : -1;
        return 0;
    });

    // Si hay algo escrito en el buscador, reaplicamos el filtro sobre el orden nuevo
    const searchInput = document.getElementById('globalSearch');
    if(searchInput && searchInput.value) {
        filterLocalUsers(searchInput.value.toLowerCase());
    } else {
        renderTable(GLOBAL_USERS);
    }
};

function updateHeaderIcons(activeKey, direction) {
    document.querySelectorAll('th i').forEach(icon => icon.className = 'bi bi-arrow-down-up ms-1 text-muted');
    const activeTh = document.querySelector(`th[onclick="sortUsers('${activeKey}')"] i`);
    if(activeTh) activeTh.className = direction === 'asc' ? 'bi bi-arrow-up ms-1 text-dark' : 'bi bi-arrow-down ms-1 text-dark';
}

/**
 * FUNCIÓN 5: ESTADÍSTICAS
 */
function calculateStats(usersList) {
    const total = usersList.length;
    const suspended = usersList.filter(u => u.suspended == true || u.suspended == 1).length;
    const active = total - suspended;
    // Lógica ejemplo para usuarios del sistema (ajusta según tu lógica real)
    const systemUsers = usersList.filter(u => u.email && u.email.includes('admin') || u.username === 'guest').length;

    const elTotal = document.getElementById('statTotal');
    const elActive = document.getElementById('statActive');
    const elSusp = document.getElementById('statSuspended');
    const elSys = document.getElementById('statSystem');

    if(elTotal) elTotal.innerText = total;
    if(elActive) elActive.innerText = active;
    if(elSusp) elSusp.innerText = suspended;
    if(elSys) elSys.innerText = systemUsers;
}


// --- CRUD SE MANTIENE IGUAL QUE ANTES (add, update, delete) ---
// ... (Tus funciones createUser, updateUser, deleteUser van aquí) ...
async function createUser() {
    const form = document.getElementById('formAddUser');
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    try {
        const response = await fetch(`${USERS_URL}/add_user`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const result = await response.json();
        if (response.ok) {
            alert('Usuario creado correctamente');
            closeModalAndReload();
        } else {
            alert('Error: ' + (result.message || 'Error desconocido'));
        }
    } catch (error) { console.error(error); }
}

async function updateUser() {
    const form = document.getElementById('formAddUser');
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());
    data.id = editingUserId;

    try {
        const response = await fetch(`${USERS_URL}/update_user`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (response.ok) {
            alert('Actualizado');
            closeModalAndReload();
        }
    } catch (error) { console.error(error); }
}

window.deleteUser = async function(id) {
    // Cambiamos el mensaje para que el usuario sepa que pasará
    if(!confirm('¿Está seguro de SUSPENDER este usuario? El usuario no podrá acceder, pero sus datos se conservarán.')) return;

    try {
        // Seguimos llamando a la ruta /delete_user para no romper el código, 
        // pero internamente el backend ahora solo suspende.
        const response = await fetch(`${USERS_URL}/delete_user`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userids: [id] })
        });

        if (response.ok) {
            alert("Usuario suspendido.");
            loadUsers('%'); 
        } else {
            alert("Error al suspender el usuario");
        }
    } catch (error) { 
        console.error(error); 
        alert("Error de conexión");
    }
}

// Función para cambiar estado: 0 = Activar, 1 = Suspender
window.toggleUserStatus = async function(id, status) {
    const action = status === 0 ? "REACTIVAR" : "SUSPENDER";
    if(!confirm(`¿Desea ${action} este usuario?`)) return;

    const data = {
        id: id,
        suspended: status
    };

    try {
        const response = await fetch(`${USERS_URL}/update_user`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (response.ok) {
            // Recargamos los datos para ver el cambio de estado en la tabla
            loadUsers('%');
        } else {
            alert('Error al actualizar el estado');
        }
    } catch (e) { console.error(e); }
}

window.prepareEdit = function(user) {
    editingUserId = user.id;
    const form = document.getElementById('formAddUser');
    form.firstname.value = user.firstname;
    form.lastname.value = user.lastname;
    form.email.value = user.email;
    form.document.value = user.idnumber || ''; 
    
    document.querySelector('.modal-title').textContent = "Editar Usuario";
    const modal = new bootstrap.Modal(document.getElementById('modalNuevoUsuario'));
    modal.show();
}

window.resetPassword = async function(id, doc) {
    if(!confirm(`¿Resetear contraseña al documento ${doc}?`)) return;
    // Implementar update aquí...
}

function closeModalAndReload() {
    const modalEl = document.getElementById('modalNuevoUsuario');
    const modal = bootstrap.Modal.getInstance(modalEl);
    modal.hide();
    loadUsers('%'); // Recargar todo
}