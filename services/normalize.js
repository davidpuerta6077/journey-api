// Normalización de datos antes de sincronizar con Moodle (y backfill de lo ya
// existente). Funciones puras, sin efectos secundarios.
//
//  - cleanSpaces:  trim + colapsar espacios internos
//  - titleCaseName: cleanSpaces + Capitalización tipo título respetando tildes,
//                   con conectores (de, del, la, ...) en minúscula salvo al inicio
//  - normalizeEmail: cleanSpaces + sin espacios + minúsculas; si queda vacío o
//                    sin "@" se devuelve el valor original (no se inventa)

const CONECTORES = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'e', 'en']);

function cleanSpaces(s) {
  if (s == null) return s;
  return String(s).trim().replace(/\s+/g, ' ');
}

function capitalizar(palabra) {
  if (!palabra) return palabra;
  return palabra
    .split('-')
    .map(seg => (seg ? seg.charAt(0).toLocaleUpperCase('es') + seg.slice(1).toLocaleLowerCase('es') : seg))
    .join('-');
}

function titleCaseName(s) {
  if (s == null) return s;
  const limpio = cleanSpaces(s);
  if (!limpio) return limpio;
  return limpio
    .split(' ')
    .map((palabra, i) => {
      const lower = palabra.toLocaleLowerCase('es');
      if (i > 0 && CONECTORES.has(lower)) return lower;
      return capitalizar(palabra);
    })
    .join(' ');
}

function normalizeEmail(s) {
  if (s == null) return s;
  const limpio = String(s).replace(/\s+/g, '').toLowerCase();
  if (!limpio || !limpio.includes('@')) return String(s).trim();
  return limpio;
}

// Devuelve solo los campos normalizados de un usuario.
function normalizeUser(u) {
  return {
    firstname: titleCaseName(u.firstname),
    lastname: titleCaseName(u.lastname),
    email: normalizeEmail(u.email),
    correo_personal: normalizeEmail(u.correo_personal),
  };
}

// Devuelve solo los campos normalizados de un curso. fullname/shortname solo se
// limpian de espacios (contienen códigos como FB0010 que no deben capitalizarse) y,
// de paso, corrigen el rótulo "Docente:" que quedó grabado en fullnames viejos
// generados por SICAU antes de renombrarlo a "Profesor:". nombre_asignatura,
// docente, departamento y programa sí llevan Capitalización tipo título.
function normalizeCourse(c) {
  return {
    fullname: cleanSpaces(c.fullname)?.replace(/Docente:/gi, 'Profesor:'),
    shortname: cleanSpaces(c.shortname),
    nombre_asignatura: titleCaseName(c.nombre_asignatura),
    docente: titleCaseName(c.docente),
    departamento: titleCaseName(c.departamento),
    programa: titleCaseName(c.programa),
  };
}

// Devuelve solo los campos normalizados de una matrícula (los mismos datos de
// asignatura/programa que se duplican en enrollments para no depender de un
// JOIN contra courses).
function normalizeEnrollment(e) {
  return {
    nombre_asignatura: titleCaseName(e.nombre_asignatura),
    programa: titleCaseName(e.programa),
  };
}

// Arma fullname/shortname con el mismo formato que usa la ingesta de SICAU, a
// partir de piezas ya normalizadas (grupo ya con el prefijo "G", nombre de
// asignatura y docente ya en Title Case). Se usa tanto al recibir un curso
// nuevo/con novedad de SICAU como al reconstruir en el backfill los cursos que
// quedaron con el fullname en mayúsculas de antes de que existiera esta
// normalización: cleanSpaces por sí solo no recapitaliza texto ya incrustado
// dentro del string, así que ahí no basta con limpiar espacios, hay que rearmarlo.
function buildCourseNames({ grupo, nombreAsignatura, codigoAsignatura, docente, periodo }) {
  const periodoFormateado = periodo ? `${String(periodo).slice(0, 4)}-${String(periodo).slice(4)}` : '';
  return {
    fullname: cleanSpaces(`${grupo || ''} ${nombreAsignatura || ''} (${codigoAsignatura || ''}) - Profesor: ${docente || ''} (${periodoFormateado})`),
    shortname: cleanSpaces(`${grupo || ''} ${nombreAsignatura || ''} (${codigoAsignatura || ''})(${periodoFormateado})`),
  };
}

// true si alguno de `keys` difiere entre el objeto original y el normalizado.
function difiere(original, normalizado, keys) {
  return keys.some(k => (original[k] ?? null) !== (normalizado[k] ?? null));
}

module.exports = {
  cleanSpaces,
  titleCaseName,
  normalizeEmail,
  normalizeUser,
  normalizeCourse,
  normalizeEnrollment,
  buildCourseNames,
  difiere,
};
