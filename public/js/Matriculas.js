// js/Matriculas.js
let allMatriculas = [];
let modalElement = null; // ✅ Solo declarar, no instanciar aún

document.addEventListener('DOMContentLoaded', () => {
    // ✅ Instanciar el modal cuando el DOM ya cargó
    modalElement = new bootstrap.Modal(document.getElementById('modalMatricula'));

    getMatriculas();

    // Filtro de búsqueda
    document.getElementById('searchMatricula').addEventListener('input', (e) => {
        const busqueda = e.target.value.toLowerCase();
        const filtrados = allMatriculas.filter(m =>
            m.documento?.toString().includes(busqueda) ||
            m.nombres?.toLowerCase().includes(busqueda) ||
            m.codigo_asignatura?.toLowerCase().includes(busqueda)
        );
        renderTable(filtrados);
    });

    // ✅ Mover el submit dentro del DOMContentLoaded
    document.getElementById('formMatricula').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const id = formData.get('id');
        const data = Object.fromEntries(formData.entries());

        // ✅ Evitar enviar el campo 'id' dentro de data
        delete data.id;

        const url = id ? '/api/matriculas/update' : '/api/matriculas/add';
        const method = id ? 'PUT' : 'POST';

        try {
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(id ? { id, data } : data)
            });

            const result = await res.json();

            if (res.ok && result.success) {
                modalElement.hide();
                e.target.reset(); // ✅ Limpiar el formulario después de guardar
                getMatriculas();
            } else {
                alert(result.message || 'Error al procesar la solicitud');
            }
        } catch (err) {
            console.error(err);
            alert('Error de conexión con el servidor');
        }
    });
});

async function getMatriculas() {
    try {
        const response = await fetch('/api/matriculas/list');
        const result = await response.json();

        if (result.success) {
            allMatriculas = result.body;
            renderTable(allMatriculas);
        } else {
            console.warn('La API respondió sin éxito:', result);
        }
    } catch (error) {
        console.error("Error al obtener matrículas:", error);
    }
}

function renderTable(data) {
    const tbody = document.querySelector('#tableMatriculas tbody');
    tbody.innerHTML = '';

    if (!data || data.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="10" class="text-center text-muted py-4">
                    No hay matrículas registradas
                </td>
            </tr>`;
        return;
    }

    data.forEach(m => {
        // ✅ Manejo seguro de fecha inválida
        const fecha = m.fecha_creacion ? new Date(m.fecha_creacion).toLocaleDateString('es-CO') : 'N/A';

        tbody.innerHTML += `
            <tr>
                <td><span class="badge bg-secondary">${m.codigo_asignatura || 'N/A'}</span></td>
                <td><small>${m.programa || 'N/A'}</small></td>
                <td>${m.documento || 'N/A'}</td>
                <td>${m.nombres || 'N/A'}</td>
                <td>${m.apellidos || 'N/A'}</td>
                <td><small>${m.correo || 'N/A'}</small></td>
                <td>${m.rol || 'N/A'}</td>
                <td>${m.periodo || 'N/A'}</td>
                <td>${fecha}</td>
                <td class="text-end">
                    <button class="btn btn-sm btn-outline-primary" onclick="prepareEdit(${m.id})">
                        <i class="bi bi-pencil"></i>
                    </button>
                </td>
            </tr>
        `;
    });
}

function prepareEdit(id) {
    const mat = allMatriculas.find(m => m.id === id);
    if (mat) {
        const form = document.getElementById('formMatricula');
        form.mat_id.value     = mat.id;
        form.documento.value  = mat.documento;
        form.codigo_asignatura.value = mat.codigo_asignatura;
        form.rol.value        = mat.rol;
        form.periodo.value    = mat.periodo;
        modalElement.show();
    }
}