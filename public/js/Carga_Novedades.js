const fileInput = document.getElementById('fileInput');
const resultBox = document.getElementById('resultBox');
let uploadedFilePath = null;

function displayMessage(message, type) {
    resultBox.classList.remove('d-none', 'alert-success', 'alert-danger', 'alert-info', 'alert-warning');
    resultBox.classList.add(`alert-${type}`);
    resultBox.innerHTML = message;
    resultBox.classList.remove('d-none');
}

async function upload_excel() {
    const file = fileInput.files[0];
    if (!file) {
        displayMessage('Por favor, selecciona un archivo Excel de novedades.', 'danger');
        return;
    }

    const formData = new FormData();
    formData.append('excel', file);

    try {
        displayMessage('Subiendo archivo de novedades...', 'info');
        
        // CAMBIO: Apunta a la ruta de novedades
        const response = await fetch('enrollments/upload-excel', { 
            method: 'POST',
            body: formData,
        });

        const data = await response.json();

        if (response.ok && !data.error) {
            uploadedFilePath = data.body.filePath;
            displayMessage(`Archivo subido con éxito: ${file.name}. Listo para procesar.`, 'success');
        } else {
            displayMessage(`Error al subir el archivo: ${data.body || 'Error desconocido'}`, 'danger');
            uploadedFilePath = null;
        }
    } catch (error) {
        console.error('Error en la solicitud de subida:', error);
        displayMessage('Error de red al subir el archivo.', 'danger');
        uploadedFilePath = null;
    }
}

async function process_excel() {
    if (!uploadedFilePath) {
        displayMessage('Primero sube un archivo Excel de novedades.', 'danger');
        return;
    }

    try {
        displayMessage('Procesando suspensiones en Moodle...', 'info');
        
        // CAMBIO: Apunta a la ruta de procesar novedades
        const response = await fetch('enrollments/process-novedades', { 
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ filePath: uploadedFilePath }),
        });

        const data = await response.json();

        if (response.ok && !data.error) {
            if (data.body.errorCount > 0) {
                const errorMessage = `Proceso completado con ${data.body.errorCount} errores y ${data.body.successCount} usuarios suspendidos. <a href="${data.body.errorFileUrl}" download class="alert-link">Descargar reporte de errores</a>`;
                displayMessage(errorMessage, 'warning');
            } else {
                displayMessage(`Proceso exitoso. Se suspendieron ${data.body.successCount} usuarios correctamente.`, 'success');
            }
        } else {
            displayMessage(`Error al procesar novedades: ${data.body || 'Error desconocido'}`, 'danger');
        }
    } catch (error) {
        console.error('Error en el procesamiento:', error);
        displayMessage('Error de red al procesar el archivo.', 'danger');
    } finally {
        uploadedFilePath = null;
        fileInput.value = '';
    }
}

// CAMBIO: Una sola plantilla con los campos requeridos para novedades
function descargarPlantilla() {
    // Encabezados que espera el backend (usuario = email, curso = código)
    const headers = [['usuario', 'curso']];
    const ws = XLSX.utils.aoa_to_sheet(headers);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Plantilla Novedades');
    XLSX.writeFile(wb, 'plantilla_novedades.xlsx');
}

function resetForm() {
    fileInput.value = '';
    uploadedFilePath = null;
    resultBox.classList.add('d-none');
    resultBox.innerHTML = '';
    displayMessage('Formulario reseteado.', 'info');
}

// Inicialización del menú (se mantiene igual para coherencia visual)
document.addEventListener('DOMContentLoaded', function () {
    const toggleMenuBtn = document.getElementById('toggle-menu');
    const sidebar = document.getElementById('sidebar');
    const userDropdown = document.getElementById('userDropdown');
    const userMenu = document.getElementById('userMenu');

    if (toggleMenuBtn) {
        toggleMenuBtn.addEventListener('click', function () {
            sidebar.classList.toggle('active');
        });
    }

    if (userDropdown) {
        userDropdown.addEventListener('click', function () {
            userMenu.classList.toggle('show');
        });
    }
    
    document.querySelectorAll('.has-submenu > a').forEach(item => {
        item.addEventListener('click', function (e) {
            e.preventDefault();
            const submenu = this.nextElementSibling;
            if (submenu && submenu.classList.contains('submenu')) {
                submenu.classList.toggle('show');
                this.querySelector('.bi-chevron-down').classList.toggle('rotate');
            }
        });
    });

    window.addEventListener('click', function (event) {
        if (userDropdown && !userDropdown.contains(event.target) && userMenu && !userMenu.contains(event.target)) {
            userMenu.classList.remove('show');
        }
    });
});