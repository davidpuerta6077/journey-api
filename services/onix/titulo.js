// Subactividades anteriores al campo título: se usa la primera línea del texto.
function tituloDe(r) {
    return r.titulo || String(r.desarrollo || '').split('\n')[0].slice(0, 80);
}

// Nombre de archivo válido en Windows y Drive a partir de un título.
function nombreArchivo(t) {
    return String(t || '').replace(/[\/:*?"<>|\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120) || 'Sin título';
}

module.exports = { tituloDe, nombreArchivo };
