const test = require('node:test');
const assert = require('node:assert');
const JSZip = require('jszip');
const word = require('../services/onix/word');

// PNG 1x1 válido
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

async function zipDe(buffer) {
    return JSZip.loadAsync(buffer);
}
async function xmlDe(buffer, parte = 'word/document.xml') {
    return (await zipDe(buffer)).file(parte).async('string');
}

const actividad = { nombre: 'Soporte', descripcion: 'Atender tickets de soporte' };

test('nombreMes y tituloDe (título o primera línea del texto, máx. 80)', () => {
    assert.strictEqual(word.nombreMes(10), 'Octubre');
    assert.strictEqual(word.tituloDe({ titulo: 'Capacitación', desarrollo: 'x' }), 'Capacitación');
    assert.strictEqual(word.tituloDe({ titulo: null, desarrollo: '- 05/10/2027: Sincronizó\n- otra' }), '- 05/10/2027: Sincronizó');
    assert.strictEqual(word.tituloDe({ desarrollo: 'a'.repeat(100) }).length, 80);
});

test('documentoActividad: encabezado, títulos en DESARROLLO, párrafos y "Enlace Formato" por subactividad, nota al pie', async () => {
    const buf = await word.documentoActividad({
        actividad, numero: 2, mes: 10, anio: 2027,
        perfil: { nombre: 'Ana Pérez', identificacion: '1001', area_nombre: 'Tecnología' },
        registros: [
            { titulo: 'Desarrollos en Bravo Hub', parrafo: 'Durante este periodo se aportó al desarrollo de Bravo Hub.' },
            { titulo: null, desarrollo: 'Implementación micrositio\nmás', parrafo: 'Durante este periodo se implementó el micrositio.' },
        ],
    });
    assert.strictEqual(buf.subarray(0, 2).toString(), 'PK');
    const xml = await xmlDe(buf);
    for (const t of ['INFORME DE ACTIVIDADES', 'ACTIVIDAD #: 2', 'Octubre', 'Tecnología', '1001', 'ACTIVIDAD 2:', 'DESARROLLO',
        'Desarrollos en Bravo Hub', '1. Desarrollos en Bravo Hub', 'Durante este periodo se aportó al desarrollo de Bravo Hub.',
        'Enlace Formato: ', '2. Implementación micrositio', 'Durante este periodo se implementó el micrositio.', 'EVIDENCIAS:']) {
        assert.ok(xml.includes(t), `falta "${t}"`);
    }
    assert.strictEqual(xml.split('Enlace Formato: ').length - 1, 2);
    assert.ok((await xmlDe(buf, 'word/footnotes.xml')).includes('Explique acá las evidencias'));
});

test('documentoSubactividad: secciones con sus imágenes y pie; sin ubicar → Muestra; enlaces → Enlaces y soportes', async () => {
    const evidencias = [
        { id: 1, tipo: 'imagen', descripcion: 'Pantalla de inicio' },
        { id: 2, tipo: 'imagen', descripcion: null },
        { id: 3, tipo: 'imagen', descripcion: 'Perdida' },
        { id: 4, tipo: 'link', contenido: 'https://grabacion.co', descripcion: 'Grabación' },
    ];
    const imagenes = new Map([[1, { datos: PNG, ext: 'png' }], [2, { datos: PNG, ext: 'png' }], [3, null]]);
    const registro = {
        titulo: 'Micrositio CELEP', desarrollo: 'notas',
        documento: { titulo: 'Informe — Desarrollo del Micrositio CELEP', secciones: [
            { titulo: 'Framework y arquitectura', texto: 'Se usó Angular.\n\nCon estructura modular.', imagenes: [1, 99] },
            { titulo: 'Resultado final', texto: 'Sitio funcional.', imagenes: [3] },
        ] },
    };
    const buf = await word.documentoSubactividad({ registro, evidencias, imagenes });
    const zip = await zipDe(buf);
    const media = Object.keys(zip.files).filter((f) => f.startsWith('word/media/'));
    assert.ok(media.length >= 2, 'debe incluir encabezado + imágenes');
    const xml = await zip.file('word/document.xml').async('string');
    for (const t of ['Informe — Desarrollo del Micrositio CELEP', '1. Framework y arquitectura', 'Se usó Angular.', 'Con estructura modular.',
        'Pantalla de inicio', '2. Resultado final', 'No se pudo cargar la imagen', 'Perdida', '3. Muestra', '4. Enlaces y soportes', 'Grabación: https://grabacion.co']) {
        assert.ok(xml.includes(t), `falta "${t}"`);
    }
});

test('documentoSubactividad sin evidencias ni título de IA usa "Informe — <título>"', async () => {
    const xml = await xmlDe(await word.documentoSubactividad({
        registro: { titulo: 'Reunión', documento: { titulo: null, secciones: [{ titulo: 'A', texto: 'a', imagenes: [] }] } },
        evidencias: [], imagenes: new Map(),
    }));
    assert.ok(xml.includes('Informe — Reunión'));
    assert.ok(!xml.includes('Muestra'));
});
