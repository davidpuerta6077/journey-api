const test = require('node:test');
const assert = require('node:assert');
const JSZip = require('jszip');
const word = require('../services/onix/word');

// PNG 1x1 válido
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

async function xmlDe(buffer) {
    const zip = await JSZip.loadAsync(buffer);
    return zip.file('word/document.xml').async('string');
}

const actividad = { nombre: 'Soporte', descripcion: 'Atender tickets de soporte' };

test('nombreMes', () => {
    assert.strictEqual(word.nombreMes(1), 'Enero');
    assert.strictEqual(word.nombreMes(10), 'Octubre');
});

test('informeActividad incluye actividad, mes, área, identificación y desarrollo', async () => {
    const buf = await word.informeActividad({
        actividad, numero: 2, desarrollo: 'Durante el mes se atendieron tickets.',
        evidencias: [{ tipo: 'link', contenido: 'https://x.co', descripcion: 'Tablero' }],
        mes: 10, anio: 2027,
        perfil: { nombre: 'Ana Pérez', identificacion: '1001', area_nombre: 'Tecnología' },
    });
    assert.strictEqual(buf.subarray(0, 2).toString(), 'PK');
    const xml = await xmlDe(buf);
    for (const t of ['ACTIVIDAD #: 2', 'Octubre', 'Tecnología', '1001', 'Durante el mes se atendieron tickets.', 'Enlace: https://x.co']) {
        assert.ok(xml.includes(t), `falta "${t}"`);
    }
    assert.ok(!xml.includes('2026'));
});

test('informeActividad sin perfil ni evidencias no falla', async () => {
    const xml = await xmlDe(await word.informeActividad({ actividad, numero: 1, desarrollo: 'D', evidencias: [], mes: 1, anio: 2027, perfil: null }));
    assert.ok(xml.includes('no se registraron evidencias'));
});

test('evidenciasActividad inserta imágenes y marca las que no se pudieron leer', async () => {
    const buf = await word.evidenciasActividad({
        actividad, numero: 1,
        registros: [{ desarrollo: 'Hice A.' }, { desarrollo: 'Hice B.' }],
        evidencias: [
            { tipo: 'imagen', contenido: '1/a.png', descripcion: 'Captura', imagen: PNG, ext: 'png' },
            { tipo: 'imagen', contenido: '1/b.jpg', descripcion: 'Perdida', imagen: null, ext: 'jpg' },
            { tipo: 'texto', contenido: 'Acta firmada', descripcion: 'Acta' },
        ],
        mes: 3, anio: 2027,
    });
    const zip = await JSZip.loadAsync(buf);
    const media = Object.keys(zip.files).filter((f) => f.startsWith('word/media/'));
    assert.ok(media.length >= 2, 'debe incluir encabezado + captura');
    const xml = await zip.file('word/document.xml').async('string');
    for (const t of ['INFORME DE SOPORTE', 'Marzo', 'Hice A. Hice B.', 'Captura', 'No se pudo cargar la imagen', 'Acta firmada']) {
        assert.ok(xml.includes(t), `falta "${t}"`);
    }
});
