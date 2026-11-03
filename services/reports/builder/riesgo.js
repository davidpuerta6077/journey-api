// Riesgo académico configurable del constructor de reportes. Cada criterio se
// activa/desactiva y tiene su umbral; el nivel sale de cuántos se cumplen.
// La configuración se guarda dentro de cada reporte (params.riesgo).
const RIESGO_DEFECTO = {
    criterios: {
        nunca_entro: { activo: true },
        sin_acceso: { activo: true, valor: 7 },
        nota_baja: { activo: true, valor: 3 },
        entregas_vencidas: { activo: true, valor: 2 },
        avance_bajo: { activo: true, valor: 50 },
    },
    cortes: { alto: 3, medio: 2, bajo: 1 },
};

function configRiesgo(cfg = {}) {
    const criterios = {};
    for (const [k, def] of Object.entries(RIESGO_DEFECTO.criterios)) {
        criterios[k] = { ...def, ...(cfg.criterios?.[k] || {}) };
    }
    return { criterios, cortes: { ...RIESGO_DEFECTO.cortes, ...(cfg.cortes || {}) } };
}

const esNum = (v) => typeof v === 'number' && Number.isFinite(v);

// Lee las columnas m_* que llena el paso de Moodle. Quien no está en Moodle
// (o no tiene la matrícula aplicada) cuenta como que nunca entró al curso.
function calcularRiesgo(row, cfg) {
    const { criterios: c, cortes } = configRiesgo(cfg);
    const nunca = row.m_nunca_entro_curso === true || row.m_en_moodle === false || row.m_matricula_en_moodle === false;
    const out = [];
    if (c.nunca_entro.activo && nunca) out.push('Nunca entró al curso');
    if (c.sin_acceso.activo && (nunca || (esNum(row.m_dias_sin_entrar_curso) && row.m_dias_sin_entrar_curso > Number(c.sin_acceso.valor)))) {
        out.push(`Sin entrar > ${c.sin_acceso.valor} días`);
    }
    if (c.nota_baja.activo && esNum(row.m_calificacion) && row.m_calificacion < Number(c.nota_baja.valor)) {
        out.push(`Calificación < ${c.nota_baja.valor}`);
    }
    if (c.entregas_vencidas.activo && esNum(row.m_entregas_vencidas) && row.m_entregas_vencidas > Number(c.entregas_vencidas.valor)) {
        out.push(`Entregas vencidas > ${c.entregas_vencidas.valor}`);
    }
    if (c.avance_bajo.activo && esNum(row.m_avance) && row.m_avance < Number(c.avance_bajo.valor)) {
        out.push(`Avance < ${c.avance_bajo.valor} %`);
    }
    const n = out.length;
    const nivel = n >= cortes.alto ? 'Alto' : n >= cortes.medio ? 'Medio' : n >= cortes.bajo && n > 0 ? 'Bajo' : 'Sin riesgo';
    return { criterios: out, nivel };
}

module.exports = { RIESGO_DEFECTO, configRiesgo, calcularRiesgo };
