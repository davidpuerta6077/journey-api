// public/Carga.js
const fileInput = document.getElementById('fileInput');
const resultBox = document.getElementById('resultBox');
let uploadedFilePath = null; // Para almacenar la ruta del archivo subido en el servidor

function displayMessage(message, type) {
    resultBox.classList.remove('d-none', 'alert-success', 'alert-danger', 'alert-info');
    resultBox.classList.add(`alert-${type}`);
    resultBox.innerHTML = message;
    resultBox.classList.remove('d-none');
}

async function upload_excel() {
    const file = fileInput.files[0];
    if (!file) {
        displayMessage('Por favor, selecciona un archivo Excel.', 'danger');
        return;
    }

    const formData = new FormData();
    formData.append('excel', file); // 'excel' debe coincidir con el nombre esperado en network.js (req.files.excel)

    try {
        displayMessage('Subiendo archivo...', 'info');
        const response = await fetch('/users/upload-excel', { // Asegúrate que esta ruta coincida con network.js
            method: 'POST',
            body: formData,
        });

        const data = await response.json();

        if (response.ok && !data.error) {
            uploadedFilePath = data.body.filePath;
            displayMessage(`Archivo subido con éxito: ${file.name}`, 'success');
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
        displayMessage('Primero sube un archivo Excel.', 'danger');
        return;
    }

    try {
        displayMessage('Procesando archivo...', 'info');
        const response = await fetch('/users/process-excel', { // Asegúrate que esta ruta coincida con network.js
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ filePath: uploadedFilePath }),
        });

        const data = await response.json();

        if (response.ok && !data.error) {
            if (data.body.errorCount > 0) {
                const errorMessage = `Proceso completado con ${data.body.errorCount} errores y ${data.body.successCount} usuarios cargados. <a href="${data.body.errorFileUrl}" download>Descargar archivo de errores</a>`;
                displayMessage(errorMessage, 'warning');
            } else {
                displayMessage(`Usuarios cargados con éxito. Total: ${data.body.successCount}`, 'success');
            }
        } else {
            displayMessage(`Error al procesar el archivo: ${data.body || 'Error desconocido'}`, 'danger');
        }
    } catch (error) {
        console.error('Error en la solicitud de procesamiento:', error);
        displayMessage('Error de red al procesar el archivo.', 'danger');
    } finally {
        // Después de procesar, la ruta del archivo ya no es relevante para nuevas acciones
        uploadedFilePath = null;
        fileInput.value = ''; // Limpiar el input de archivo
    }
}

function descargarPlantilla() {
    // Generar un Excel básico con los encabezados
    const headers = [['name', 'last_name', 'document', 'email']];
    const ws = XLSX.utils.aoa_to_sheet(headers);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Plantilla Usuarios');

    // Descargar el archivo
    XLSX.writeFile(wb, 'plantilla_usuarios.xlsx');
}

function resetForm() {
    fileInput.value = '';
    uploadedFilePath = null;
    resultBox.classList.add('d-none');
    resultBox.innerHTML = '';
    displayMessage('Formulario reseteado. Puedes cargar un nuevo archivo.', 'info');
}

// Script para el menú lateral (asumiendo que está en Carga.js si no lo tienes aparte)
document.addEventListener('DOMContentLoaded', function () {
    const toggleMenuBtn = document.getElementById('toggle-menu');
    const sidebar = document.getElementById('sidebar');
    const userDropdown = document.getElementById('userDropdown');
    const userMenu = document.getElementById('userMenu');

    toggleMenuBtn.addEventListener('click', function () {
        sidebar.classList.toggle('active');
    });

    userDropdown.addEventListener('click', function () {
        userMenu.classList.toggle('show');
    });

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

    // Cerrar el menú de usuario si se hace clic fuera
    window.addEventListener('click', function (event) {
        if (!userDropdown.contains(event.target) && !userMenu.contains(event.target)) {
            userMenu.classList.remove('show');
        }
    });
});