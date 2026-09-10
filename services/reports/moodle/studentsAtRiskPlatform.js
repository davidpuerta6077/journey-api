const { getCategorias, filtrarCategorias, getCursosDeCategoria, getEnrolados, tieneRol, diasDesde, fechaCorta } = require('./_moodleRest');
const { meta, normCategoryId, normInt } = require('../_util');

async function studentsAtRiskPlatform(params = {}) {
    const diasSinAcceso = normInt(params.diasSinAcceso, 30);
    const categoryId = normCategoryId(params.categoryId);

    const cats = filtrarCategorias(await getCategorias(), categoryId, true);
    const porUsuario = new Map();

    for (const cat of cats) {
        const cursos = await getCursosDeCategoria(cat.id);
        for (const curso of cursos) {
            const enrolados = await getEnrolados(curso.id);
            if (!enrolados) continue;
            for (const u of enrolados) {
                if (!tieneRol(u, 'student')) continue;
                const la = u.lastaccess || 0;
                const prev = porUsuario.get(u.id);
                if (!prev || la > prev.lastaccess) {
                    porUsuario.set(u.id, { nombre: u.fullname, email: u.email, username: u.username, lastaccess: la });
                }
            }
        }
    }

    const rows = [];
    for (const v of porUsuario.values()) {
        if (v.lastaccess === 0 || diasDesde(v.lastaccess) >= diasSinAcceso) {
            rows.push({
                nombre: v.nombre,
                email: v.email,
                username: v.username,
                ultimo_acceso: fechaCorta(v.lastaccess),
                dias_inactivo: diasDesde(v.lastaccess),
            });
        }
    }

    return {
        columns: [
            { key: 'nombre', label: 'Estudiante' },
            { key: 'email', label: 'Correo' },
            { key: 'username', label: 'Usuario' },
            { key: 'ultimo_acceso', label: 'Último acceso' },
            { key: 'dias_inactivo', label: 'Días inactivo' },
        ],
        rows,
        meta: meta('moodle_students_at_risk_platform', { diasSinAcceso, categoryId }),
    };
}
module.exports = { studentsAtRiskPlatform };
