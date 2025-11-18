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
        displayMessage('Por favor, selecciona un archivo Excel de matrículas.', 'danger');
        return;
    }

    const formData = new FormData();
    formData.append('excel', file);

    try {
        displayMessage('Subiendo archivo de matrículas...', 'info');
        const response = await fetch('/enrollments/upload-excel', { // <-- Endpoint de matrículas
            method: 'POST',
            body: formData,
        });

        const data = await response.json();

        if (response.ok && !data.error) {
            uploadedFilePath = data.body.filePath;
            displayMessage(`Archivo de matrículas subido con éxito: ${file.name}`, 'success');
        } else {
            displayMessage(`Error al subir el archivo de matrículas: ${data.body || 'Error desconocido'}`, 'danger');
            uploadedFilePath = null;
        }
    } catch (error) {
        console.error('Error en la solicitud de subida de matrículas:', error);
        displayMessage('Error de red al subir el archivo de matrículas.', 'danger');
        uploadedFilePath = null;
    }
}

async function process_excel() {
    if (!uploadedFilePath) {
        displayMessage('Primero sube un archivo Excel de matrículas.', 'danger');
        return;
    }

    try {
        displayMessage('Procesando archivo de matrículas...', 'info');
        const response = await fetch('/enrollments/process-excel', { // <-- Endpoint de matrículas
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ filePath: uploadedFilePath }),
        });

        const data = await response.json();

        if (response.ok && !data.error) {
            if (data.body.errorCount > 0) {
                const errorMessage = `Proceso de matrículas completado con ${data.body.errorCount} errores y ${data.body.successCount} matrículas realizadas. <a href="${data.body.errorFileUrl}" download>Descargar archivo de errores</a>`;
                displayMessage(errorMessage, 'warning');
            } else {
                displayMessage(`Matrículas realizadas con éxito. Total: ${data.body.successCount}`, 'success');
            }
        } else {
            displayMessage(`Error al procesar el archivo de matrículas: ${data.body || 'Error desconocido'}`, 'danger');
        }
    } catch (error) {
        console.error('Error en la solicitud de procesamiento de matrículas:', error);
        displayMessage('Error de red al procesar el archivo de matrículas.', 'danger');
    } finally {
        uploadedFilePath = null;
        fileInput.value = '';
    }
}

function descargarPlantillaCorta() {
    const headers = [['email', 'code', 'rol','state','period']];
    const ws = XLSX.utils.aoa_to_sheet(headers);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Plantilla Matriculas Corta');
    XLSX.writeFile(wb, 'plantilla_matriculas_corta.xlsx');
}

function descargarPlantillaExtendida() {
    const headers = [['email', 'code', 'rol', 'state', 'period', 'name', 'last_name', 'document','personalMail', 'phone', 'cellPhone', 'Fecha_de_Nacimiento', 'jornada', 'departamento', 'plan_estudios']];
    const ws = XLSX.utils.aoa_to_sheet(headers);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Plantilla Matriculas Extendida');
    XLSX.writeFile(wb, 'plantilla_matriculas_extendida.xlsx');
}

function resetForm() {
    fileInput.value = '';
    uploadedFilePath = null;
    resultBox.classList.add('d-none');
    resultBox.innerHTML = '';
    displayMessage('Formulario reseteado. Puedes cargar un nuevo archivo.', 'info');
}

// ... (El código de inicialización del menú lateral, si está aquí, puede permanecer igual)
document.addEventListener('DOMContentLoaded', function () {
    const toggleMenuBtn = document.getElementById('toggle-menu');
    const sidebar = document.getElementById('sidebar');
    const userDropdown = document.getElementById('userDropdown');
    const userMenu = document.getElementById('userMenu');

    if (toggleMenuBtn) { // Asegurarse de que el elemento exista
        toggleMenuBtn.addEventListener('click', function () {
            sidebar.classList.toggle('active');
        });
    }

    if (userDropdown) { // Asegurarse de que el elemento exista
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