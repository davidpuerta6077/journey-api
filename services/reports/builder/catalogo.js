// Lista blanca del constructor de reportes: cada conjunto de datos con su FROM
// y las columnas elegibles (key -> expresión SQL fija). Nada que venga del
// front llega al SQL salvo una key de esta lista. Columnas nuevas de la BD no
// aparecen solas: se agregan acá. Las contraseñas nunca se listan.
// `{s}` en from/expr = schema (lo reemplaza reportBuilderQuery).
// tipo: 'texto' | 'numero' | 'fecha' | 'bool' (el front elige operadores por tipo).

const FECHA = (x) => `to_char(${x}, 'YYYY-MM-DD')`;
const FECHA_HORA = (x) => `to_char(${x}, 'YYYY-MM-DD HH24:MI')`;

// [columna, etiqueta, tipo, expresión opcional ('$' = alias.columna)]
const USERS = [
    ['id', 'ID Nexo', 'numero'],
    ['nombre_completo', 'Nombre completo', 'texto', "TRIM(CONCAT(u.firstname, ' ', u.lastname))"],
    ['firstname', 'Nombres', 'texto'],
    ['lastname', 'Apellidos', 'texto'],
    ['documento', 'Documento', 'texto'],
    ['username', 'Usuario', 'texto'],
    ['email', 'Correo institucional', 'texto'],
    ['correo_personal', 'Correo personal', 'texto'],
    ['telefono', 'Teléfono', 'texto'],
    ['celular', 'Celular', 'texto'],
    ['fecha_nacimiento', 'Fecha de nacimiento', 'fecha', FECHA('$')],
    ['city', 'Ciudad', 'texto'],
    ['country', 'País', 'texto'],
    ['jornada', 'Jornada', 'texto'],
    ['departamento_academico', 'Departamento académico', 'texto'],
    ['plan_estudios', 'Plan de estudios', 'texto'],
    ['estado', 'Estado', 'texto'],
    ['sincronizado', 'Sincronizado a Moodle', 'bool'],
    ['source', 'Origen', 'texto', '$::text'],
    ['correo_pendiente', 'Correo pendiente', 'texto'],
    ['novedad_datos', 'Novedad de datos', 'texto', '$::text'],
    ['moodle_id', 'ID Moodle', 'numero'],
    ['created_at', 'Creado en Nexo', 'fecha', FECHA_HORA('$')],
];

const COURSES = [
    ['id', 'ID Nexo', 'numero'],
    ['idnumber', 'Código del curso (idnumber)', 'texto'],
    ['shortname', 'Nombre corto', 'texto'],
    ['fullname', 'Nombre completo', 'texto'],
    ['codigo_asignatura', 'Código de asignatura', 'texto'],
    ['nombre_asignatura', 'Asignatura', 'texto'],
    ['programa', 'Programa', 'texto'],
    ['departamento', 'Departamento', 'texto'],
    ['periodo', 'Periodo', 'texto'],
    ['grupo', 'Grupo', 'texto'],
    ['nombre_profesor', 'Profesor', 'texto'],
    ['documento', 'Documento del profesor', 'texto'],
    ['correo_institucional', 'Correo del profesor', 'texto'],
    ['celular', 'Celular del profesor', 'texto'],
    ['fecha_inicio', 'Fecha de inicio', 'fecha', FECHA('$')],
    ['fecha_fin', 'Fecha de fin', 'fecha', FECHA('$')],
    ['templatecourse', 'Plantilla', 'texto'],
    ['seed_course_id', 'Curso semilla (id)', 'numero'],
    ['categoryid', 'Categoría Moodle (id)', 'numero'],
    ['visible', 'Visible', 'bool'],
    ['format', 'Formato', 'texto'],
    ['numsections', 'Secciones', 'numero'],
    ['summary', 'Resumen', 'texto'],
    ['sincronizado', 'Sincronizado a Moodle', 'bool'],
    ['estado_sync', 'Estado de sincronización', 'texto'],
    ['ultimo_error_sync', 'Último error de sincronización', 'texto'],
    ['synced_at', 'Sincronizado el', 'fecha', FECHA_HORA('$')],
    ['novedad_datos', 'Novedad de datos', 'texto', '$::text'],
    ['moodle_id', 'ID Moodle', 'numero'],
    ['created_at', 'Creado en Nexo', 'fecha', FECHA_HORA('$')],
];

const ENROLLMENTS = [
    ['id', 'ID matrícula', 'numero'],
    ['role', 'Rol', 'texto', "CASE e.role WHEN 'student' THEN 'Estudiante' WHEN 'editingteacher' THEN 'Profesor' WHEN 'teacher' THEN 'Profesor sin edición' ELSE e.role END"],
    ['estado', 'Estado de la matrícula', 'texto'],
    ['estado_anterior', 'Estado anterior', 'texto'],
    ['fecha_cambio_estado', 'Fecha del cambio de estado', 'fecha', FECHA_HORA('$')],
    ['codigo_journey', 'Código Nexo', 'texto'],
    ['codigo_asignatura', 'Código de asignatura', 'texto'],
    ['nombre_asignatura', 'Asignatura', 'texto'],
    ['programa', 'Programa', 'texto'],
    ['periodo', 'Periodo', 'texto'],
    ['grupo', 'Grupo', 'texto'],
    ['fecha_creacion_journey', 'Fecha de matrícula', 'fecha', FECHA('$')],
    ['sincronizado', 'Sincronizada a Moodle', 'bool'],
    ['estado_sync', 'Estado de sincronización', 'texto'],
    ['ultimo_error_sync', 'Último error de sincronización', 'texto'],
    ['source', 'Origen', 'texto', '$::text'],
    ['moodle_enrollment_id', 'ID matrícula Moodle', 'numero'],
    ['created_at', 'Creada en Nexo', 'fecha', FECHA_HORA('$')],
];

const NOVEDADES = [
    ['id', 'ID', 'numero'],
    ['fecha', 'Fecha', 'fecha', FECHA_HORA("($ AT TIME ZONE 'America/Bogota')")],
    ['nivel', 'Nivel', 'texto'],
    ['tipo', 'Tipo', 'texto'],
    ['motivo', 'Motivo', 'texto'],
    ['cedula', 'Cédula', 'texto'],
    ['codigo_journey', 'Código Nexo', 'texto'],
    ['codigo_asignatura', 'Código de asignatura', 'texto'],
    ['nombre_asignatura', 'Asignatura', 'texto'],
    ['periodo', 'Periodo', 'texto'],
    ['grupo', 'Grupo', 'texto'],
    // [{campo, anterior, actual}] -> "grupo: G101 → G102; ..."
    ['cambios', 'Cambios', 'texto', "(SELECT string_agg(concat(x->>'campo', ': ', COALESCE(x->>'anterior', '—'), ' → ', COALESCE(x->>'actual', '—')), '; ') FROM jsonb_array_elements(CASE WHEN jsonb_typeof($) = 'array' THEN $ ELSE '[]'::jsonb END) x)"],
    ['usuario_sicau', 'Usuario SICAU', 'texto'],
    ['resultado', 'Resultado', 'texto'],
];

const ENVIO_USUARIOS = [
    ['username', 'Usuario', 'texto'],
    ['idnumber', 'Documento (idnumber)', 'texto'],
    ['firstname', 'Nombres', 'texto'],
    ['lastname', 'Apellidos', 'texto'],
    ['email', 'Correo', 'texto'],
];
const ENVIO_CURSOS = [
    ['idnumber', 'Código del curso (idnumber)', 'texto'],
    ['shortname', 'Nombre corto', 'texto'],
    ['fullname', 'Nombre completo', 'texto'],
    ['templatecourse', 'Plantilla', 'texto'],
    ['startdate', 'Fecha de inicio', 'fecha', FECHA('$')],
    ['enddate', 'Fecha de fin', 'fecha', FECHA('$')],
];
const ENVIO_MATRICULAS = [
    ['userid', 'Documento del usuario', 'texto'],
    ['courseid', 'Código del curso (idnumber)', 'texto'],
    ['role', 'Rol', 'texto'],
];

function cols(lista, alias, prefijo, grupo) {
    return lista.map(([col, label, tipo, expr]) => ({
        key: `${prefijo}${col}`,
        label,
        grupo,
        tipo,
        expr: expr ? expr.replace(/\$/g, `${alias}.${col}`) : `${alias}.${col}`,
    }));
}

// Columnas que llena el paso de Moodle (services/reports/builder/moodle.js).
const MOODLE_PLATAFORMA = [
    { key: 'm_en_moodle', label: 'Existe en Moodle', tipo: 'bool' },
    { key: 'm_ultimo_acceso_plataforma', label: 'Último acceso a la plataforma', tipo: 'fecha' },
    { key: 'm_nunca_entro_plataforma', label: 'Nunca entró a la plataforma', tipo: 'bool' },
    { key: 'm_dias_sin_entrar_plataforma', label: 'Días sin entrar a la plataforma', tipo: 'numero' },
    { key: 'm_perfil_url', label: 'Perfil en Moodle', tipo: 'texto' },
];
const MOODLE_CURSO = [
    { key: 'm_matricula_en_moodle', label: 'Matrícula aplicada en Moodle', tipo: 'bool' },
    { key: 'm_ultimo_acceso_curso', label: 'Último acceso al curso', tipo: 'fecha' },
    { key: 'm_nunca_entro_curso', label: 'Nunca entró al curso', tipo: 'bool' },
    { key: 'm_dias_sin_entrar_curso', label: 'Días sin entrar al curso', tipo: 'numero' },
    { key: 'm_calificacion', label: 'Calificación (0 a 5)', tipo: 'numero' },
    { key: 'm_avance', label: 'Avance del curso (%)', tipo: 'numero' },
    { key: 'm_entregas_vencidas', label: 'Entregas vencidas sin hacer', tipo: 'numero' },
];
const RIESGO = [
    { key: 'riesgo_nivel', label: 'Nivel de riesgo', tipo: 'texto' },
    { key: 'riesgo_cantidad', label: 'Criterios cumplidos (cantidad)', tipo: 'numero' },
    { key: 'riesgo_criterios', label: 'Criterios cumplidos', tipo: 'texto' },
];
const moodle = (lista, grupo = 'Moodle') => lista.map((c) => ({ ...c, grupo, moodle: true }));

const CLAVES_USUARIO = { _username: 'u.username', _documento: 'u.documento' };

const DATASETS = {
    matriculas: {
        label: 'Matrículas (+ estudiante + curso)',
        from: '{s}.enrollments e LEFT JOIN {s}.users u ON u.id = e.userid LEFT JOIN {s}.courses c ON c.id = e.courseid',
        claves: { ...CLAVES_USUARIO, _curso_idnumber: 'c.idnumber', _curso_shortname: 'c.shortname' },
        defecto: ['u_nombre_completo', 'u_documento', 'u_email', 'c_codigo_asignatura', 'c_nombre_asignatura', 'c_programa', 'e_periodo', 'e_grupo', 'e_role', 'e_estado'],
        columnas: [
            ...cols(USERS, 'u', 'u_', 'Estudiante'),
            ...cols(COURSES, 'c', 'c_', 'Curso'),
            ...cols(ENROLLMENTS, 'e', 'e_', 'Matrícula'),
            ...moodle([...MOODLE_PLATAFORMA, ...MOODLE_CURSO]),
            ...moodle(RIESGO, 'Riesgo'),
        ],
    },
    usuarios: {
        label: 'Usuarios',
        from: '{s}.users u',
        claves: CLAVES_USUARIO,
        defecto: ['u_nombre_completo', 'u_documento', 'u_username', 'u_email', 'u_estado', 'u_sincronizado'],
        columnas: [...cols(USERS, 'u', 'u_', 'Usuario'), ...moodle(MOODLE_PLATAFORMA)],
    },
    cursos: {
        label: 'Cursos',
        from: '{s}.courses c',
        claves: {},
        defecto: ['c_idnumber', 'c_nombre_asignatura', 'c_programa', 'c_periodo', 'c_grupo', 'c_nombre_profesor', 'c_estado_sync'],
        columnas: cols(COURSES, 'c', 'c_', 'Curso'),
    },
    novedades: {
        label: 'Novedades SICAU',
        from: '{s}.sicau_novedades n',
        claves: {},
        defecto: ['n_fecha', 'n_nivel', 'n_tipo', 'n_motivo', 'n_cedula', 'n_codigo_journey', 'n_usuario_sicau', 'n_resultado'],
        columnas: cols(NOVEDADES, 'n', 'n_', 'Novedad'),
    },
    moodle_usuarios: {
        label: 'Lo que va a Moodle: usuarios',
        from: '{s}.moodle_auth_users mu',
        claves: {},
        defecto: ENVIO_USUARIOS.map(([c]) => `mu_${c}`),
        columnas: cols(ENVIO_USUARIOS, 'mu', 'mu_', 'Usuario enviado'),
    },
    moodle_cursos: {
        label: 'Lo que va a Moodle: cursos',
        from: '{s}.moodle_courses mc',
        claves: {},
        defecto: ENVIO_CURSOS.map(([c]) => `mc_${c}`),
        columnas: cols(ENVIO_CURSOS, 'mc', 'mc_', 'Curso enviado'),
    },
    moodle_matriculas: {
        label: 'Lo que va a Moodle: matrículas',
        from: '{s}.moodle_enrol me',
        claves: {},
        defecto: ENVIO_MATRICULAS.map(([c]) => `me_${c}`),
        columnas: cols(ENVIO_MATRICULAS, 'me', 'me_', 'Matrícula enviada'),
    },
};

function catalogoPublico() {
    return Object.entries(DATASETS).map(([key, d]) => ({
        key,
        label: d.label,
        defecto: d.defecto,
        columnas: d.columnas.map(({ key: k, label, grupo, tipo, moodle: m }) => ({ key: k, label, grupo, tipo, ...(m ? { moodle: true } : {}) })),
    }));
}

module.exports = { DATASETS, catalogoPublico };
