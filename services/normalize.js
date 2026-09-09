// Normalización de datos antes de sincronizar con Moodle (y backfill de lo ya
// existente). Funciones puras, sin efectos secundarios.
//
//  - cleanSpaces:  trim + colapsar espacios internos
//  - titleCaseName: cleanSpaces + Capitalización tipo título respetando tildes,
//                   con conectores (de, del, la, ...) en minúscula salvo al inicio
//  - normalizeEmail: cleanSpaces + sin espacios + minúsculas; si queda vacío o
//                    sin "@" se devuelve el valor original (no se inventa)

const CONECTORES = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'e']);

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
// limpian de espacios (contienen códigos como FB0010 que no deben capitalizarse);
// nombre_asignatura sí lleva Capitalización tipo título.
function normalizeCourse(c) {
  return {
    fullname: cleanSpaces(c.fullname),
    shortname: cleanSpaces(c.shortname),
    nombre_asignatura: titleCaseName(c.nombre_asignatura),
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
  difiere,
};
