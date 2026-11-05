const path = require('path');
const fs = require('fs');
const xlsx = require('xlsx');
const coursesCtrl = require('../../api/courses/index');
const postgresql = require('../../database/postgresql');
const { moodleRequest } = require('../moodleService');
const { assertMoodleOk } = require('../moodleAssert');
const { normalizeCourse, buildCourseNames, normalizeGrupo, cleanSpaces, normalizeEmail } = require('../normalize');

// Carga masiva de cursos (Carga Masiva > Cursos). Cada fila del Excel termina
// en uno de tres resultados:
//  - "migrado": el curso YA existe en Moodle (p. ej. los cursos antiguos de
//    producción) y no en Nexo. Se registra en Nexo apuntando a ese curso
//    (moodle_id) y ya sincronizado: NO se duplica ninguna semilla. Desde ahí se
//    matriculan estudiantes con la carga de matrículas (columna code = idnumber).
//  - "creado": el curso no existe en Moodle. Se crea en Nexo pendiente, con el
//    mismo formato que SICAU (idnumber = código + periodo + grupo), y Sync >
//    Cursos lo crea en Moodle desde la semilla.
//  - error: la fila no se pudo cargar (va al Excel de errores con el motivo).
//
// Cómo se encuentra el curso en Moodle:
//  - Con nombre_corto_moodle: se busca por shortname (único en Moodle).
//  - Sin él: se arma el idnumber y se busca por idnumber; si ya está en Moodle
//    se vincula (migrado) en vez de crearlo otra vez.
// La matrícula por BD externa (vista moodle_enrol) usa el idnumber del curso,
// así que un curso migrado sin idnumber en Moodle recibe uno (código + periodo
// + grupo) con core_course_update_courses.

const COLUMNAS = [
    'nombre_corto_moodle', 'codigo_asignatura', 'nombre_asignatura', 'periodo', 'grupo',
    'programa', 'departamento', 'profesor', 'documento_profesor', 'correo_profesor',
    'fecha_inicio', 'fecha_fin',
];

const texto = (v) => (v === null || v === undefined ? '' : cleanSpaces(String(v)) || '');

// Fecha del Excel (Date con cellDates, texto "YYYY-MM-DD" o "DD/MM/YYYY") -> "YYYY-MM-DD".
function fecha(v) {
    if (v instanceof Date && !isNaN(v)) return v.toISOString().slice(0, 10);
    const s = texto(v);
    if (!s) return null;
    let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
    m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    return undefined; // formato no reconocido
}
const fechaUnix = (ts) => (ts ? new Date(ts * 1000).toISOString().slice(0, 10) : null);

async function moodleCursoPor(field, value) {
    const r = assertMoodleOk(
        await moodleRequest('core_course_get_courses_by_field', { field, value }),
        `Error buscando el curso en Moodle por ${field}`
    );
    return r?.courses?.[0] || null;
}

function leerFilas(filePath) {
    const wb = xlsx.readFile(filePath, { cellDates: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    return xlsx.utils.sheet_to_json(ws, { defval: '' }).map((raw) => {
        // Encabezados sin importar mayúsculas/espacios ("Nombre corto Moodle" -> nombre_corto_moodle).
        const row = {};
        for (const [k, v] of Object.entries(raw)) {
            row[String(k).trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '_')] = v;
        }
        return row;
    });
}

async function procesarFila(row) {
    const r = {
        shortnameMoodle: texto(row.nombre_corto_moodle),
        codigo: texto(row.codigo_asignatura).toUpperCase(),
        nombre: texto(row.nombre_asignatura),
        periodo: texto(row.periodo),
        grupo: normalizeGrupo(texto(row.grupo)),
        programa: texto(row.programa) || null,
        departamento: texto(row.departamento) || null,
        profesor: texto(row.profesor) || null,
        documento: texto(row.documento_profesor) || null,
        correo: row.correo_profesor ? normalizeEmail(String(row.correo_profesor)) : null,
        inicio: fecha(row.fecha_inicio),
        fin: fecha(row.fecha_fin),
    };
    if (r.inicio === undefined || r.fin === undefined) {
        throw new Error('Fecha inválida: usa AAAA-MM-DD o DD/MM/AAAA');
    }
    const idnumberArmado = r.codigo && r.periodo && r.grupo ? `${r.codigo}${r.periodo}${r.grupo}` : null;

    let mc = null;
    if (r.shortnameMoodle) {
        mc = await moodleCursoPor('shortname', r.shortnameMoodle);
        if (!mc) throw new Error(`No existe en Moodle un curso con nombre corto "${r.shortnameMoodle}"`);
    } else {
        if (!idnumberArmado || !r.nombre) {
            throw new Error('Para crear un curso nuevo llena codigo_asignatura, nombre_asignatura, periodo y grupo (o nombre_corto_moodle para migrar uno existente)');
        }
        mc = await moodleCursoPor('idnumber', idnumberArmado);
    }
    return mc ? migrar(r, mc, idnumberArmado) : crear(r, idnumberArmado);
}

async function migrar(r, mc, idnumberArmado) {
    const yaEnNexo = (await postgresql.findCourseByMoodleId(mc.id))[0];
    if (yaEnNexo) throw new Error(`El curso de Moodle "${mc.shortname}" ya está en Nexo (idnumber ${yaEnNexo.idnumber || '—'})`);

    let idnumber = texto(mc.idnumber);
    let idnumberAsignado = false;
    if (!idnumber) {
        if (!idnumberArmado) {
            throw new Error(`El curso "${mc.shortname}" no tiene idnumber en Moodle: llena codigo_asignatura, periodo y grupo para asignarle uno`);
        }
        const otro = await moodleCursoPor('idnumber', idnumberArmado);
        if (otro) throw new Error(`No se puede asignar el idnumber ${idnumberArmado}: ya lo usa el curso "${otro.shortname}" en Moodle`);
        idnumber = idnumberArmado;
        idnumberAsignado = true;
    }

    const local = (await postgresql.findCourseSicau(idnumber))[0];
    if (local && local.moodle_id && local.moodle_id !== mc.id) {
        throw new Error(`El idnumber ${idnumber} ya está en Nexo apuntando a otro curso de Moodle`);
    }

    if (idnumberAsignado) {
        assertMoodleOk(await moodleRequest('core_course_update_courses', {
            'courses[0][id]': mc.id,
            'courses[0][idnumber]': idnumber,
        }), 'Error asignando el idnumber en Moodle');
    }

    // Ya existía en Nexo pendiente (p. ej. llegó de SICAU y aún no se sincronizaba):
    // se vincula al curso de Moodle en vez de crear otra fila, así Sync no duplica la semilla.
    if (local) {
        await coursesCtrl.updateCourseMoodleId(local.id, mc.id);
        await coursesCtrl.markCourseAsSynchronized(local.id);
        return { resultado: 'migrado', idnumber, nota: 'vinculado a un curso que ya estaba en Nexo' };
    }

    // Nombre, nombre corto y categoría salen de Moodle tal cual: así una
    // re-sincronización no renombra cursos antiguos.
    const created = await coursesCtrl.addElement({
        fullname: mc.fullname, shortname: mc.shortname, idnumber, categoryid: mc.categoryid,
        moodle_id: mc.id, seed_course_id: null, summary: null,
        visible: mc.visible === undefined ? true : Boolean(mc.visible), format: mc.format || 'topics', numsections: 10,
        departamento: r.departamento, programa: r.programa, nombre_profesor: r.profesor,
        documento: r.documento, celular: null, correo_institucional: r.correo,
        fecha_inicio: r.inicio || fechaUnix(mc.startdate), fecha_fin: r.fin || fechaUnix(mc.enddate),
        periodo: r.periodo || null, grupo: r.grupo || null,
        codigo_asignatura: r.codigo || null, nombre_asignatura: r.nombre || null,
        templatecourse: null,
    });
    await coursesCtrl.markCourseAsSynchronized(created[0].id);
    return { resultado: 'migrado', idnumber, nota: idnumberAsignado ? 'se le asignó idnumber en Moodle' : '' };
}

async function crear(r, idnumber) {
    if ((await postgresql.findCourseSicau(idnumber))[0]) throw new Error(`Ya existe en Nexo un curso con idnumber ${idnumber}`);
    const norm = normalizeCourse({ nombre_asignatura: r.nombre, nombre_profesor: r.profesor, departamento: r.departamento, programa: r.programa });
    const { fullname, shortname } = buildCourseNames({
        grupo: r.grupo, nombreAsignatura: norm.nombre_asignatura, codigoAsignatura: r.codigo,
        nombreProfesor: norm.nombre_profesor, periodo: r.periodo,
    });
    await coursesCtrl.addElement({
        fullname, shortname, idnumber, categoryid: null,
        moodle_id: null, seed_course_id: null, summary: null,
        visible: true, format: 'topics', numsections: 10,
        departamento: r.departamento, programa: r.programa, nombre_profesor: r.profesor,
        documento: r.documento, celular: null, correo_institucional: r.correo,
        fecha_inicio: r.inicio, fecha_fin: r.fin,
        periodo: r.periodo, grupo: r.grupo,
        codigo_asignatura: r.codigo, nombre_asignatura: r.nombre,
        templatecourse: `SEMILLA-${r.codigo}`,
    });
    return { resultado: 'creado', idnumber, nota: 'pendiente: créalo en Moodle desde Sync > Cursos' };
}

async function procesarExcelCursos(filePath) {
    const filas = leerFilas(filePath);
    const detalle = [];
    const errores = [];
    let creados = 0;
    let migrados = 0;

    for (let i = 0; i < filas.length; i++) {
        const row = filas[i];
        const fila = i + 2; // fila 1 = encabezados
        if (COLUMNAS.every((c) => !texto(row[c]))) continue; // fila vacía
        try {
            const r = await procesarFila(row);
            if (r.resultado === 'migrado') migrados++; else creados++;
            detalle.push({ fila, resultado: r.resultado, idnumber: r.idnumber, nota: r.nota });
        } catch (err) {
            errores.push({ fila, error: err.message, ...Object.fromEntries(COLUMNAS.map((c) => [c, row[c] instanceof Date ? fecha(row[c]) : row[c]])) });
            detalle.push({ fila, resultado: 'error', error: err.message });
        }
    }

    let errorFileUrl = null;
    if (errores.length) {
        const wb = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(wb, xlsx.utils.json_to_sheet(errores), 'Errores de Carga');
        const fileName = `errores_carga_cursos_${Date.now()}.xlsx`;
        const dir = path.join(__dirname, '../../uploads');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        xlsx.writeFile(wb, path.join(dir, fileName));
        errorFileUrl = `/uploads/${fileName}`;
    }
    return { creados, migrados, errorCount: errores.length, errorFileUrl, detalle };
}

module.exports = { procesarExcelCursos, COLUMNAS };
