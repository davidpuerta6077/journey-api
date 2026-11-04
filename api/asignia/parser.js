// Lectura del Excel de programación académica (pestaña "PROGRAMACIÓN" del
// borrador de programación). Las columnas se ubican por el nombre del
// encabezado (sin tildes, mayúsculas ni espacios extra), no por posición.
const ExcelJS = require('exceljs');

const norm = (s) => String(s ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ').trim().toLowerCase();

// campo -> encabezados aceptados (normalizados). Si un encabezado se repite
// (p. ej. "Curso" y "curso " en el borrador) gana el primero.
const COLUMNAS = {
    periodo: ['periodo'],
    sede: ['nombresede', 'sede', 'nombre sede'],
    programa: ['programa'],
    plan: ['plan'],
    nivel: ['nivel'],
    codigo: ['codigo'],
    curso: ['curso'],
    agrupamiento: ['agrupamientos', 'agrupamiento'],
    grupo: ['grupo sicau', 'grupo'],
    creditos: ['creditos'],
    horas_semana: ['h. semana', 'horas semana'],
    espacio: ['espacio fisico'],
    jornada: ['jornada'],
    profesor_nombre: ['profesor', 'docente'],
    profesor_documento: ['documento', 'cedula', 'identificacion'],
    profesor_correo: ['correo institucional', 'emailinstitucional', 'correo'],
    vinculacion: ['tipo de vinculacion'],
};
const REQUERIDAS = ['codigo', 'curso', 'profesor_nombre', 'profesor_documento', 'profesor_correo'];
const DIAS = [
    ['lunes', 'Lunes'], ['martes', 'Martes'], ['miercoles', 'Miércoles'],
    ['jueves', 'Jueves'], ['viernes', 'Viernes'], ['sabado', 'Sábado'], ['domingo', 'Domingo'],
];
const SIN_PROFESOR = ['', 'n/a', 'na', '-', 'por asignar', 'vacio'];
const NOMBRES_CAMPO = {
    codigo: 'Código', curso: 'Curso', profesor_nombre: 'Profesor',
    profesor_documento: 'Documento', profesor_correo: 'Correo Institucional',
};

function httpError(message, status) {
    const err = new Error(message);
    err.status = status;
    return err;
}

function textoCelda(v) {
    if (v === null || v === undefined) return '';
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    if (typeof v === 'object') {
        if (Array.isArray(v.richText)) return v.richText.map((t) => t.text).join('');
        if ('result' in v) return textoCelda(v.result);
        if ('text' in v) return textoCelda(v.text);
        if ('error' in v) return '';
    }
    return String(v);
}

const hora = (h) => {
    const [hh, mm = '00'] = h.split(':');
    return `${hh.padStart(2, '0')}:${mm.padStart(2, '0')}`;
};

// "06-08\nB6-306B" -> [{ dia, hora: '06:00 - 08:00', aula: 'B6-306B' }]
// Una celda puede traer varios rangos; el resto del texto es el aula. Excel a
// veces convierte "06-08" en la fecha 6 de agosto: llega como "AAAA-08-06".
const RANGO = /^(\d{1,2}(?::\d{2})?)\s*-\s*(\d{1,2}(?::\d{2})?)\b\s*(.*)$/;
const FECHA = /^\d{4}-(\d{2})-(\d{2})$/;
function parseDia(dia, texto) {
    const lineas = texto.split(/\r?\n/).map((l) => l.trim().replace(FECHA, '$2-$1')).filter(Boolean);
    if (!lineas.length) return [];
    const esRango = (l) => {
        const m = l.match(RANGO);
        return m && parseInt(m[1], 10) <= 24 && parseInt(m[2], 10) <= 24 ? m : null;
    };
    const rangos = lineas.map(esRango).filter(Boolean);
    const aula = [...new Set([...lineas.filter((l) => !esRango(l)), ...rangos.map((m) => m[3])].filter(Boolean))].join(' ');
    if (!rangos.length) return [{ dia, hora: aula, aula: '' }];
    return rangos.map(([, a, b]) => ({ dia, hora: `${hora(a)} - ${hora(b)}`, aula }));
}

function ubicarEncabezado(matriz) {
    for (let i = 0; i < Math.min(matriz.length, 15); i++) {
        const fila = matriz[i].map(norm);
        if (fila.includes('codigo') && fila.includes('curso')) return i;
    }
    return -1;
}

// matriz: filas de celdas en texto (la primera con encabezados en algún lugar
// de las primeras 15). Devuelve las filas listas para guardar.
function parseMatriz(matriz) {
    const h = ubicarEncabezado(matriz);
    if (h < 0) throw httpError('No se encontró la fila de encabezados (debe tener "Código" y "Curso")', 400);
    const encabezados = matriz[h].map(norm);

    const idx = {};
    for (const [campo, nombres] of Object.entries(COLUMNAS)) {
        const i = encabezados.findIndex((e) => nombres.includes(e));
        if (i >= 0) idx[campo] = i;
    }
    const faltan = REQUERIDAS.filter((c) => idx[c] === undefined);
    if (faltan.length) {
        throw httpError(`Al archivo le faltan columnas: ${faltan.map((c) => NOMBRES_CAMPO[c]).join(', ')}`, 400);
    }
    const dias = DIAS.map(([n, nombre]) => [encabezados.indexOf(n), nombre]).filter(([i]) => i >= 0);

    const filas = [];
    let omitidas = 0;
    for (const celdas of matriz.slice(h + 1)) {
        const v = (campo) => (idx[campo] === undefined ? '' : String(celdas[idx[campo]] ?? '').trim());
        if (!celdas.some((c) => String(c ?? '').trim())) continue;
        const codigo = v('codigo');
        const curso = v('curso');
        if (!codigo || !curso) { omitidas++; continue; }

        let nombre = v('profesor_nombre').replace(/\s+/g, ' ');
        if (SIN_PROFESOR.includes(nombre.toLowerCase())) nombre = '';
        const documento = v('profesor_documento').replace(/\D/g, '');
        const correo = v('profesor_correo').toLowerCase();
        const conProfesor = Boolean(nombre);

        filas.push({
            periodo: v('periodo'),
            sede: v('sede'),
            programa: v('programa'),
            plan: v('plan'),
            nivel: v('nivel'),
            codigo,
            curso,
            grupo: v('grupo'),
            agrupamiento: v('agrupamiento'),
            creditos: v('creditos'),
            horas_semana: v('horas_semana'),
            espacio: v('espacio'),
            jornada: v('jornada'),
            horario: dias.flatMap(([i, dia]) => parseDia(dia, String(celdas[i] ?? ''))),
            profesor_nombre: nombre,
            profesor_documento: conProfesor && documento.length >= 5 ? documento : '',
            profesor_correo: conProfesor && correo.includes('@') ? correo : '',
            vinculacion: conProfesor ? v('vinculacion') : '',
        });
    }
    return { filas, omitidas };
}

// Prefiere la hoja "PROGRAMACIÓN"; si no existe, la primera con columnas Código y Curso.
async function leerExcel(filePath) {
    const wb = new ExcelJS.Workbook();
    try {
        await wb.xlsx.readFile(filePath);
    } catch {
        throw httpError('No se pudo leer el archivo. Debe ser un Excel .xlsx', 400);
    }
    const aMatriz = (ws) => {
        const m = [];
        ws.eachRow({ includeEmpty: true }, (row) => {
            const celdas = [];
            // Filas ocultas por filtro/ocultar en Excel no se cargan: solo lo que el usuario ve.
            if (row.hidden) { m.push(celdas); return; }
            for (let c = 1; c <= row.cellCount; c++) celdas.push(textoCelda(row.getCell(c).value));
            m.push(celdas);
        });
        return m;
    };
    const hojas = [...wb.worksheets].sort((a, b) =>
        Number(norm(b.name) === 'programacion') - Number(norm(a.name) === 'programacion'));
    for (const ws of hojas) {
        const m = aMatriz(ws);
        if (ubicarEncabezado(m) >= 0) return { hoja: ws.name, ...parseMatriz(m) };
    }
    throw httpError('Ninguna hoja del archivo tiene las columnas "Código" y "Curso"', 400);
}

module.exports = { parseMatriz, parseDia, leerExcel };
