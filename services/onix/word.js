const fs = require('fs');
const path = require('path');
const {
    Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
    ImageRun, Header, AlignmentType, WidthType, BorderStyle, ShadingType, FootnoteReferenceRun,
} = require('docx');
const { tituloDe } = require('./titulo');

// Genera los Word del módulo Informes con el formato que se entrega en Drive:
// el documento de cada actividad y el documento de evidencia de cada subactividad.
const ENCABEZADO = path.join(__dirname, '../../assets/onix-encabezado.jpg');
const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

function nombreMes(mes) {
    return MESES[mes - 1];
}

const border = { style: BorderStyle.SINGLE, size: 1, color: '000000' };
const borders = { top: border, bottom: border, left: border, right: border };

function cell(text, bold = false, width = 4680, bg = null) {
    return new TableCell({
        width: { size: width, type: WidthType.DXA },
        borders,
        shading: bg ? { fill: bg, type: ShadingType.CLEAR } : undefined,
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
        children: [new Paragraph({ children: [new TextRun({ text: text || '', bold, font: 'Arial', size: 20 })] })],
    });
}

function titulo(text) {
    return new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 120 },
        children: [new TextRun({ text, bold: true, font: 'Arial', size: 22 })],
    });
}

function subtitulo(text) {
    return new Paragraph({
        spacing: { before: 200, after: 80 },
        children: [new TextRun({ text, bold: true, font: 'Arial', size: 20 })],
    });
}

function parrafo(text) {
    return new Paragraph({
        alignment: AlignmentType.JUSTIFIED,
        spacing: { after: 80 },
        children: [new TextRun({ text: text || '', font: 'Arial', size: 20 })],
    });
}

const lineaVacia = () => new Paragraph({ children: [new TextRun('')] });

function encabezado() {
    return new Header({
        children: [new Paragraph({
            children: [new ImageRun({ data: fs.readFileSync(ENCABEZADO), transformation: { width: 620, height: 108 }, type: 'jpg' })],
            spacing: { after: 200 },
        })],
    });
}

function filaDato(etiqueta, valor) {
    return new TableRow({ children: [cell(etiqueta, true, 3120, 'F2F2F2'), cell(valor, false, 6240)] });
}

function documento(children, footnotes) {
    return Packer.toBuffer(new Document({
        ...(footnotes ? { footnotes } : {}),
        sections: [{
            properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1800, right: 1440, bottom: 1440, left: 1440 } } },
            headers: { default: encabezado() },
            children,
        }],
    }));
}

const NOTA_DESARROLLO = 'Explique acá las evidencias para esta actividad en particular. Anexe en este documento: imágenes de actividades o reuniones, url de actas, listas de asistencia, documentación técnica y relacionados, con una corta introducción a cada actividad (por favor no genere carpetas adicionales para alojar fotos o pantallazo de documentos, anéxelos acá directamente).';

// Ancho y alto de un PNG o JPEG, para no deformar las imágenes en el Word.
function dimensiones(buf) {
    if (buf.length > 24 && buf.readUInt32BE(0) === 0x89504e47) {
        return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
    }
    let i = 2;
    while (buf[0] === 0xff && buf[1] === 0xd8 && i + 9 < buf.length) {
        if (buf[i] !== 0xff) return null;
        const marca = buf[i + 1];
        const largo = buf.readUInt16BE(i + 2);
        if (marca >= 0xc0 && marca <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marca)) {
            return { w: buf.readUInt16BE(i + 7), h: buf.readUInt16BE(i + 5) };
        }
        i += 2 + largo;
    }
    return null;
}

function imagen(data, ext) {
    const d = dimensiones(data);
    const ancho = d && d.w > 0 ? Math.min(560, d.w) : 480;
    const alto = d && d.w > 0 ? Math.round((d.h / d.w) * ancho) : 320;
    return new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 120, after: 60 },
        children: [new ImageRun({ data, transformation: { width: ancho, height: alto }, type: ext === 'png' ? 'png' : 'jpg' })],
    });
}

function pie(text) {
    return new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 160 },
        children: [new TextRun({ text, italics: true, font: 'Arial', size: 18, color: '555555' })],
    });
}

function textoEvidencia(e) {
    if (e.tipo === 'link') return e.descripcion ? `${e.descripcion}: ${e.contenido}` : e.contenido;
    return e.descripcion ? `${e.descripcion}: ${e.contenido}` : e.contenido;
}

// Documento de la actividad (Evidencia_<Mes>_actividad_<N>.docx): encabezado,
// títulos de las subactividades en DESARROLLO y, en EVIDENCIAS, el párrafo de
// cada una con su línea "Enlace Formato:" para pegar el link de Drive.
function documentoActividad({ actividad, numero, registros, mes, anio, perfil }) {
    const evidencias = registros.flatMap((r, i) => [
        subtitulo(`${i + 1}. ${tituloDe(r)}`),
        parrafo(r.parrafo),
        new Paragraph({
            spacing: { after: 160 },
            children: [
                new TextRun({ text: 'Enlace Formato: ', bold: true, font: 'Arial', size: 20 }),
                new TextRun({ text: '____________________ ', font: 'Arial', size: 20 }),
                new TextRun({ text: tituloDe(r), font: 'Arial', size: 20 }),
            ],
        }),
    ]);

    return documento([
        titulo('INFORME DE ACTIVIDADES'),
        lineaVacia(),
        new Table({
            width: { size: 9360, type: WidthType.DXA },
            columnWidths: [3120, 6240],
            rows: [
                filaDato(`ACTIVIDAD #: ${numero}`, actividad.descripcion),
                filaDato('MES:', nombreMes(mes)),
                filaDato('ÁREA:', perfil?.area_nombre || ''),
                filaDato('IDENTIFICACIÓN:', perfil?.identificacion || ''),
            ],
        }),
        lineaVacia(),
        subtitulo(`ACTIVIDAD ${numero}:`),
        parrafo(actividad.descripcion),
        lineaVacia(),
        new Paragraph({
            spacing: { before: 200, after: 80 },
            children: [new TextRun({ text: 'DESARROLLO', bold: true, font: 'Arial', size: 20 }), new FootnoteReferenceRun(1)],
        }),
        ...registros.map((r) => parrafo(tituloDe(r))),
        lineaVacia(),
        subtitulo('EVIDENCIAS:'),
        ...evidencias,
    ], { 1: { children: [new Paragraph({ children: [new TextRun({ text: NOTA_DESARROLLO, font: 'Arial', size: 16 })] })] } });
}

// Documento de evidencia de una subactividad: secciones organizadas por la IA
// con sus imágenes; las imágenes que la IA no ubicó van a "Muestra" y los
// enlaces/soportes a "Enlaces y soportes". `imagenes` es un Map id -> { datos, ext } | null.
function documentoSubactividad({ registro, evidencias, imagenes }) {
    const doc = registro.documento || { secciones: [] };
    const fotos = evidencias.filter((e) => e.tipo === 'imagen');
    const porId = new Map(fotos.map((e) => [e.id, e]));
    const ubicadas = new Set(doc.secciones.flatMap((s) => s.imagenes || []));

    const bloqueImagen = (e) => {
        const img = imagenes.get(e.id);
        return [img ? imagen(img.datos, img.ext) : parrafo('[No se pudo cargar la imagen]'), ...(e.descripcion ? [pie(e.descripcion)] : [])];
    };

    const secciones = doc.secciones.map((s) => ({
        titulo: s.titulo,
        cuerpo: [
            ...s.texto.split(/\n\s*\n/).map((t) => parrafo(t.trim())),
            ...(s.imagenes || []).filter((id) => porId.has(id)).flatMap((id) => bloqueImagen(porId.get(id))),
        ],
    }));
    const sueltas = fotos.filter((e) => !ubicadas.has(e.id));
    if (sueltas.length) secciones.push({ titulo: 'Muestra', cuerpo: sueltas.flatMap(bloqueImagen) });
    const otras = evidencias.filter((e) => e.tipo !== 'imagen');
    if (otras.length) secciones.push({ titulo: 'Enlaces y soportes', cuerpo: otras.map((e) => parrafo(textoEvidencia(e))) });

    return documento([
        titulo(doc.titulo || `Informe — ${tituloDe(registro)}`),
        lineaVacia(),
        ...secciones.flatMap((s, i) => [subtitulo(`${i + 1}. ${s.titulo || 'Detalle'}`), ...s.cuerpo]),
    ]);
}

module.exports = { nombreMes, tituloDe, documentoActividad, documentoSubactividad };
