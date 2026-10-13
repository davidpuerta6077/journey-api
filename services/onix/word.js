const fs = require('fs');
const path = require('path');
const {
    Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
    ImageRun, Header, AlignmentType, WidthType, BorderStyle, ShadingType,
} = require('docx');

// Genera los dos Word del módulo Informes con el formato institucional que
// usaba ONIXIA: el informe de una actividad y el documento de evidencias.
const ENCABEZADO = path.join(__dirname, '../../assets/onix-encabezado.jpg');
const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const NOTA = 'NOTA: Tenga presente que la validación y cumplimiento de sus obligaciones son requeridas para la aprobación de este informe.';

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

function nota() {
    return new Paragraph({
        spacing: { before: 300 },
        children: [new TextRun({ text: NOTA, font: 'Arial', size: 18, color: '555555' })],
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

function documento(children) {
    return Packer.toBuffer(new Document({
        sections: [{
            properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1800, right: 1440, bottom: 1440, left: 1440 } } },
            headers: { default: encabezado() },
            children,
        }],
    }));
}

function textoEvidencia(e) {
    if (e.tipo === 'link') return `Enlace: ${e.contenido}`;
    if (e.tipo === 'imagen') return '[Imagen adjunta en documento de evidencias]';
    return e.contenido;
}

function informeActividad({ actividad, numero, desarrollo, evidencias, mes, anio, perfil }) {
    const evRows = evidencias.length > 0
        ? evidencias.flatMap((e, i) => [subtitulo(`${i + 1}. ${e.descripcion || `Evidencia ${i + 1}`}`), parrafo(textoEvidencia(e)), lineaVacia()])
        : [parrafo('Durante este período no se registraron evidencias adicionales.')];

    return documento([
        titulo('INFORME DE ACTIVIDADES'),
        lineaVacia(),
        new Table({
            width: { size: 9360, type: WidthType.DXA },
            columnWidths: [3120, 6240],
            rows: [
                filaDato(`ACTIVIDAD #: ${numero}`, actividad.descripcion),
                filaDato('MES:', `${nombreMes(mes)} ${anio}`),
                filaDato('ÁREA:', perfil?.area_nombre || ''),
                filaDato('IDENTIFICACIÓN:', perfil?.identificacion || ''),
            ],
        }),
        lineaVacia(),
        subtitulo(`ACTIVIDAD ${numero}:`),
        parrafo(actividad.descripcion),
        lineaVacia(),
        subtitulo('DESARROLLO'),
        parrafo(desarrollo),
        lineaVacia(),
        subtitulo('EVIDENCIAS:'),
        ...evRows,
        nota(),
    ]);
}

function evidenciasActividad({ actividad, numero, registros, evidencias, mes, anio }) {
    const desarrolloTexto = registros.map((r) => r.desarrollo).filter(Boolean).join(' ');

    const evRows = evidencias.flatMap((e, i) => {
        const items = [subtitulo(`${i + 1}. ${e.descripcion || `Evidencia ${i + 1}`}`)];
        if (e.tipo === 'imagen') {
            items.push(e.imagen
                ? new Paragraph({ children: [new ImageRun({ data: e.imagen, transformation: { width: 400, height: 300 }, type: e.ext === 'png' ? 'png' : 'jpg' })] })
                : parrafo('[No se pudo cargar la imagen]'));
        } else {
            items.push(parrafo(textoEvidencia(e)));
        }
        items.push(lineaVacia());
        return items;
    });

    return documento([
        titulo(`INFORME DE ${actividad.nombre.toUpperCase()}`),
        lineaVacia(),
        new Table({
            width: { size: 9360, type: WidthType.DXA },
            columnWidths: [3120, 6240],
            rows: [
                filaDato(`ACTIVIDAD #: ${numero}`, actividad.descripcion),
                filaDato('MES:', `${nombreMes(mes)} ${anio}`),
            ],
        }),
        lineaVacia(),
        subtitulo(`ACTIVIDAD ${numero}:`),
        parrafo(actividad.descripcion),
        lineaVacia(),
        subtitulo('DESARROLLO'),
        parrafo(desarrolloTexto),
        lineaVacia(),
        subtitulo('EVIDENCIAS:'),
        ...evRows,
        nota(),
    ]);
}

module.exports = { nombreMes, informeActividad, evidenciasActividad };
